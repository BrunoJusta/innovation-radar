/**
 * Recolha diária do Radar de Inovação.
 * fontes ativas → já visto? → pré-filtro por palavras-chave → texto completo → Gemini (classifica e resume)
 * → corte de relevância → fusão com notícias já existentes (embeddings + confirmação) → signals (pending)
 * Só o resumo é guardado; o texto completo nunca vai para a base de dados.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./lib/admin";
import { fetchRss, fetchWp, FeedItem, FetchError } from "./lib/feeds";
import { extractArticle, htmlToText, matchKeywords } from "./lib/text";
import { normalizeUrl, urlHash } from "./lib/url";
import { classify, confirmAndMerge, embed } from "./lib/gemini";
import { migrarEstrutura, Reclass, reclassificar } from "./lib/migracao";
import { cosine, lisbon } from "./lib/math";
import type { Area, Category, Fonte, RunSource, Settings, Signal, Source } from "../src/lib/types";
import { DEFAULT_SETTINGS } from "../src/lib/types";

const SEEN_DAYS = 90;
const MERGE_DAYS = 14;
const MERGE_SIM = Number(process.env.MERGE_SIM || 0.86);
const MAX_PER_SOURCE = Number(process.env.MAX_PER_SOURCE || 40);
const DRY = process.env.DRY_RUN === "1";
const now = () => new Date().toISOString();
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const db = adminDb();

  // Agendado: corre só uma vez por dia, a partir das 6h em Lisboa (o GitHub tem dois crons por causa da hora de verão)
  if (process.env.SCHEDULED === "1") {
    const L = lisbon();
    if (L.hour < 6) { log(`Agendamento ignorado: são ${L.hour}h em Lisboa.`); return; }
    const today = await db.collection("runs").where("dia", "==", L.day).limit(10).get();
    if (today.docs.some((d) => d.data().estado !== "erro" && d.data().tipo !== "startups")) { log(`Já houve uma recolha hoje (${L.day}).`); return; }
  }

  // Taxonomia v2 (cadeias de valor e tags): instala-se uma vez, antes de ler a estrutura
  await migrarEstrutura(db, log, DRY);

  const [areasS, catsS, srcS, setS] = await Promise.all([
    db.collection("areas").get(), db.collection("categories").get(),
    db.collection("sources").where("ativo", "==", true).get(), db.doc("settings/geral").get(),
  ]);
  const areas = areasS.docs.map((d) => ({ id: d.id, ...d.data() }) as Area).sort((a, b) => a.ordem - b.ordem);
  const cats = catsS.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
  // As fontes das startups são lidas pela recolha semanal (startups-run.ts)
  const sources = srcS.docs.map((d) => ({ id: d.id, ...d.data() }) as Source).filter((s) => s.para !== "startups");
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(setS.data() || {}) };
  if (!areas.length || !cats.length) throw new Error("Não há áreas ou categorias. Corre primeiro o seed.");
  const keywords = [...new Set(cats.flatMap((c) => c.palavrasChave || []))];
  log(`${sources.length} fontes, ${areas.length} cadeias de valor, ${cats.length} tags, ${keywords.length} palavras-chave, corte ${settings.corteRelevancia}`);

  const runRef = db.collection("runs").doc();
  const run = { inicio: now(), dia: lisbon().day, estado: "a correr", fontes: [] as RunSource[], dryRun: DRY || undefined };
  if (!DRY) await runRef.set(run);

  // Candidatos a fusão: embeddings das notícias dos últimos dias (mais as que entram nesta execução)
  const since = new Date(Date.now() - (MERGE_DAYS + 7) * 864e5).toISOString();
  const embS = await db.collection("embeddings").where("data", ">=", since).get();
  const pool = embS.docs.map((d) => ({ id: d.id, vec: d.data().vec as number[], data: d.data().data as string }));
  const windowStart = Date.now() - settings.janelaDias * 864e5;

  try {
    for (const src of sources) {
      const st: RunSource = { sourceId: src.id, nome: src.nome, lidos: 0, jaVistos: 0, filtro: 0, relevantes: 0, novos: 0, fundidos: 0, erros: [] };
      run.fontes.push(st);
      let items: FeedItem[] = [];
      try { items = src.tipo === "wp-api" ? await fetchWp(src.url) : await fetchRss(src.url); }
      catch (e) {
        st.erros.push(`Feed: ${(e as Error).message}`); log(src.nome, "erro no feed", (e as Error).message);
        // Bloqueio anti-robôs: desliga a fonte e marca-a como bloqueada no backoffice
        if (e instanceof FetchError && e.bloqueio && !DRY) {
          await db.doc(`sources/${src.id}`).update({ ativo: false, bloqueado: { em: now(), por: e.bloqueio, http: e.status, url: src.url } });
          st.erros.push("Fonte desligada automaticamente: o site bloqueia a recolha (Cloudflare).");
          log(src.nome, "bloqueada pela Cloudflare: fonte desligada");
        }
        continue;
      }
      items = items.filter((i) => Date.parse(i.date) >= windowStart).slice(0, MAX_PER_SOURCE);
      st.lidos = items.length;
      log(`${src.nome}: ${items.length} artigos no feed`);

      // Já vistos (lidos em lote)
      const hashes = items.map((i) => urlHash(i.url));
      const seenDocs = hashes.length ? await db.getAll(...hashes.map((h) => db.doc(`seen/${h}`))) : [];
      const seen = new Set(seenDocs.filter((d) => d.exists).map((d) => d.id));

      for (let k = 0; k < items.length; k++) {
        const it = items[k], h = hashes[k];
        if (seen.has(h)) { st.jaVistos++; continue; }
        seen.add(h);
        const markSeen = (motivo: string) => DRY ? Promise.resolve() :
          db.doc(`seen/${h}`).set({ url: normalizeUrl(it.url), sourceId: src.id, motivo, visto: now(), expira: Timestamp.fromMillis(Date.now() + SEEN_DAYS * 864e5) });
        try {
          let texto = htmlToText(it.html || "");
          if (!matchKeywords(`${it.title}\n${texto}`, keywords).length) { st.filtro++; await markSeen("filtro"); continue; }
          if (texto.length < 800) {
            try { const full = await extractArticle(it.url); if (full.length > texto.length) texto = full; }
            catch (e) { if (!texto) throw e; }
          }
          const c = await classify({ titulo: it.title, site: src.nome, data: it.date, texto }, areas, cats);
          if (c.relevancia < settings.corteRelevancia) { await markSeen(`irrelevante:${c.relevancia}`); log(`  · ${c.relevancia} ${it.title}`); continue; }
          st.relevantes++;

          const fonte: Fonte = { site: src.nome, sourceId: src.id, url: it.url, urlHash: h, tituloOriginal: it.title, data: it.date, ...(it.author ? { autor: it.author } : {}) };
          const vec = await embed(`${c.titulo_pt}\n${c.resumo_pt}`);
          const t = Date.parse(it.date);
          const cands = pool
            .filter((p) => Math.abs(Date.parse(p.data) - t) <= MERGE_DAYS * 864e5)
            .map((p) => ({ ...p, sim: cosine(vec, p.vec) }))
            .filter((p) => p.sim >= MERGE_SIM).sort((a, b) => b.sim - a.sim).slice(0, 2);

          let merged = false;
          for (const cand of cands) {
            const ref = db.doc(`signals/${cand.id}`);
            const snap = await ref.get();
            if (!snap.exists) continue;
            const s = { id: snap.id, ...snap.data() } as Signal;
            if (s.fontes?.some((f) => f.urlHash === h)) { merged = true; break; }
            const m = await confirmAndMerge(s, { ...c, site: src.nome });
            if (!m.mesma) continue;
            const upd: Record<string, unknown> = {
              fontes: FieldValue.arrayUnion(fonte), relevancia: Math.max(s.relevancia, c.relevancia), atualizadoEm: now(),
              ...(m.titulo_pt ? { titulo: m.titulo_pt } : {}), ...(m.resumo_pt ? { resumo: m.resumo_pt } : {}),
              ...(m.porque_pt ? { porque: m.porque_pt } : {}), ...(m.entidades?.length ? { entidades: m.entidades.slice(0, 6) } : {}),
              // A fonte nova pode trazer tags que a notícia ainda não tinha (a cadeia de valor fica a que estava)
              ...(c.tags.length ? { tags: FieldValue.arrayUnion(...c.tags) } : {}),
            };
            // Aprovada recebe fonte nova: volta à triagem, mas o radar mantém a versão publicada até nova aprovação
            if (s.status === "approved") { upd.status = "pending"; upd.flagNovaFonte = true; }
            if (!DRY) await ref.update(upd);
            st.fundidos++; merged = true;
            log(`  ⇄ ${c.relevancia} fundida em ${s.id} (${cand.sim.toFixed(3)}) ${c.titulo_pt}`);
            break;
          }

          if (!merged) {
            const ref = db.collection("signals").doc();
            const sig: Omit<Signal, "id"> = {
              status: "pending", titulo: c.titulo_pt, resumo: c.resumo_pt, porque: c.porque_pt, entidades: c.entidades.slice(0, 6),
              area: c.area, tags: c.tags, relevancia: c.relevancia, destaque: false, fontes: [fonte],
              dataPublicacao: it.date, criadoEm: now(), atualizadoEm: now(), noRadar: false, publicado: null,
            };
            if (!DRY) {
              await ref.set(sig);
              await db.doc(`embeddings/${ref.id}`).set({ vec, data: it.date, criadoEm: now() });
            }
            pool.push({ id: ref.id, vec, data: it.date });
            st.novos++;
            log(`  + ${c.relevancia} ${c.titulo_pt}`);
          }
          await markSeen("relevante");
        } catch (e) {
          // Sem marcar como visto: volta a tentar na próxima execução
          st.erros.push(`${it.title.slice(0, 60)}: ${(e as Error).message.slice(0, 160)}`);
          log("  ! erro", it.url, (e as Error).message);
        }
      }
      if (!DRY) await runRef.update({ fontes: run.fontes });
    }

    // Notícias da taxonomia antiga: a Gemini dá-lhes cadeia de valor e tags (aos poucos, até acabarem)
    let reclass: Reclass | undefined;
    try { const rc = await reclassificar(db, areas, cats, log, DRY); if (rc.tentadas) reclass = { ...rc, erros: rc.erros.slice(0, 20) }; }
    catch (e) { log("Reclassificação falhou", (e as Error).message); }

    // Limpeza: registos de "já visto" expirados
    let apagados = 0;
    if (!DRY) for (;;) {
      const old = await db.collection("seen").where("expira", "<", Timestamp.now()).limit(400).get();
      if (old.empty) break;
      const b = db.batch(); old.docs.forEach((d) => b.delete(d.ref)); await b.commit(); apagados += old.size;
    }
    // Limpeza: notícias rejeitadas que ficaram na base de dados (a página fechou antes de o BO as apagar, ou são de antes desta regra).
    // As startups rejeitadas NÃO são apagadas: são o arquivo de triagem (contam na Review). Só o botão Eliminar do BO apaga uma startup.
    let rejApagadas = 0;
    if (!DRY) {
      const rs = await db.collection("signals").where("status", "==", "rejected").get();
      for (let i = 0; i < rs.docs.length; i += 400) {
        const b = db.batch(); rs.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
      }
      rejApagadas += rs.size;
      if (rejApagadas) log(`Rejeitadas apagadas: ${rejApagadas}`);
    }
    const fim = now();
    if (!DRY) await runRef.update({ estado: "ok", fim, fontes: run.fontes, seenApagados: apagados, rejeitadasApagadas: rejApagadas, ...(reclass ? { reclassificacao: reclass } : {}) });
    log("Concluída.", JSON.stringify(run.fontes.map(({ nome, lidos, novos, fundidos, erros }) => ({ nome, lidos, novos, fundidos, erros: erros.length }))));
  } catch (e) {
    if (!DRY) await runRef.update({ estado: "erro", fim: now(), fontes: run.fontes, erroGeral: (e as Error).message });
    throw e;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
