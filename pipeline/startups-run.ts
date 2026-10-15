/**
 * Recolha semanal de startups.
 * Pesquisas online por setor (Gemini + Pesquisa Google) + startups citadas nas notícias da semana
 * → site próprio e a responder → já existe? junta a origem : corte de relevância → startups (pending)
 */
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./lib/admin";
import { checkSite, Candidate, discover, domainOf, fromNews, profile, startupId } from "./lib/startups";
import { lisbon } from "./lib/math";
import type { RunSource, Sector, Settings, Signal, Startup, StartupOrigem } from "../src/lib/types";
import { DEFAULT_SETTINGS } from "../src/lib/types";

const DRY = process.env.DRY_RUN === "1";
const MAX_NEW = Number(process.env.MAX_NEW_STARTUPS || 40);
const now = () => new Date().toISOString();
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

/** Semana ISO (AAAA-Wnn) para correr só uma vez por semana. */
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((+t - +y) / 864e5 + 1) / 7)).padStart(2, "0")}`;
}

async function main() {
  const db = adminDb();
  const semana = isoWeek();
  if (process.env.SCHEDULED === "1") {
    const L = lisbon();
    if (L.hour < 7) { log(`Agendamento ignorado: são ${L.hour}h em Lisboa.`); return; }
    const feitas = await db.collection("runs").where("semana", "==", semana).limit(5).get();
    if (feitas.docs.some((d) => d.data().tipo === "startups" && d.data().estado !== "erro")) { log(`Já houve recolha de startups na semana ${semana}.`); return; }
  }

  const [secS, setS, stS, seenS] = await Promise.all([
    db.collection("sectors").get(), db.doc("settings/geral").get(),
    db.collection("startups").select("origens", "status").get(), db.collection("startupSeen").select().get(),
  ]);
  const sectors = secS.docs.map((d) => ({ id: d.id, ...d.data() }) as Sector).sort((a, b) => a.ordem - b.ordem);
  if (!sectors.length) throw new Error("Não há setores de startups. Corre primeiro o seed.");
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(setS.data() || {}) };
  const corte = settings.corteStartups ?? 50;
  const existing = new Map(stS.docs.map((d) => [d.id, new Set(((d.data().origens || []) as StartupOrigem[]).map((o) => o.url))]));
  const seen = new Set(seenS.docs.map((d) => d.id));
  log(`${sectors.length} setores, ${existing.size} startups já registadas, corte ${corte}`);

  const runRef = db.collection("runs").doc();
  const run = { tipo: "startups", inicio: now(), dia: lisbon().day, semana, estado: "a correr", fontes: [] as RunSource[], dryRun: DRY || undefined };
  if (!DRY) await runRef.set(run);
  let novos = 0;

  /** Trata um candidato: junta a uma ficha existente, descarta ou cria na triagem. */
  async function handle(c: Candidate, origem: StartupOrigem, st: RunSource) {
    st.lidos++;
    const prev = existing.get(c.id);
    if (prev) {
      if (!prev.has(origem.url)) {
        prev.add(origem.url); st.fundidos++;
        if (!DRY) await db.doc(`startups/${c.id}`).update({ origens: FieldValue.arrayUnion(origem), atualizadoEm: now() });
      } else st.jaVistos++;
      return;
    }
    if (seen.has(c.id)) { st.jaVistos++; return; }
    seen.add(c.id);
    const markSeen = (motivo: string) => DRY ? Promise.resolve() : db.doc(`startupSeen/${c.id}`).set({ nome: c.nome, site: c.site, motivo, visto: now() });
    const chk = await checkSite(c.site);
    if (!chk.ok) { st.filtro++; await markSeen("site sem resposta"); log(`  · site falhou ${c.site}`); return; }
    if (c.relevancia < corte) { await markSeen(`irrelevante:${c.relevancia}`); log(`  · ${c.relevancia} ${c.nome}`); return; }
    if (novos >= MAX_NEW) { st.erros.push(`Limite de ${MAX_NEW} startups novas por execução atingido.`); return; }
    st.relevantes++;
    const { fonte: _f, id, ...f } = c; // eslint-disable-line @typescript-eslint/no-unused-vars
    const doc: Omit<Startup, "id"> = {
      ...f, cidade: f.cidade || undefined, status: "pending", destaque: false, origens: [origem],
      criadoEm: now(), atualizadoEm: now(),
    };
    if (!DRY) await db.doc(`startups/${id}`).create(Object.fromEntries(Object.entries(doc).filter(([, v]) => v !== undefined)));
    existing.set(id, new Set([origem.url])); novos++; st.novos++;
    log(`  + ${c.relevancia} ${c.nome} (${c.dominio})`);
  }

  try {
    // 1) Pesquisas online por setor
    for (const sec of sectors) {
      const st: RunSource = { sourceId: sec.id, nome: `Pesquisa · ${sec.nome}`, lidos: 0, jaVistos: 0, filtro: 0, relevantes: 0, novos: 0, fundidos: 0, erros: [] };
      run.fontes.push(st);
      for (const q of sec.pesquisas || []) {
        try {
          const found = await discover(q, sectors);
          log(`${sec.nome} «${q}»: ${found.length}`);
          for (const c of found) await handle(c, { tipo: "pesquisa", titulo: c.fonte.titulo, url: c.fonte.url, data: now(), pesquisa: q }, st);
        } catch (e) { st.erros.push(`«${q}»: ${(e as Error).message.slice(0, 160)}`); log("  ! erro", q, (e as Error).message); }
      }
      if (!DRY) await runRef.update({ fontes: run.fontes });
    }

    // 2) Startups citadas nas notícias dos últimos 8 dias
    const st: RunSource = { sourceId: "noticias", nome: "Notícias da semana", lidos: 0, jaVistos: 0, filtro: 0, relevantes: 0, novos: 0, fundidos: 0, erros: [] };
    run.fontes.push(st);
    try {
      const since = new Date(Date.now() - 8 * 864e5).toISOString();
      const sigS = await db.collection("signals").where("criadoEm", ">=", since).get();
      const news = sigS.docs.map((d) => d.data() as Signal).filter((s) => s.status !== "rejected")
        .map((s) => ({ titulo: s.titulo, resumo: s.resumo, entidades: s.entidades || [], url: s.fontes?.[0]?.url || "" })).filter((n) => n.url).slice(0, 60);
      const named = await fromNews(news);
      log(`Notícias: ${news.length} lidas, ${named.length} startups citadas`);
      for (const n of named) {
        const d = domainOf(n.site);
        if (d && (existing.has(startupId(d)) || seen.has(startupId(d)))) {
          await handle({ id: startupId(d) } as Candidate, { tipo: "noticia", titulo: n.titulo, url: n.url, data: now() }, st);
          continue;
        }
        try {
          const c = await profile(n.site, sectors, n.nome);
          if (c) await handle(c, { tipo: "noticia", titulo: n.titulo, url: n.url, data: now() }, st);
          else st.filtro++;
        } catch (e) { st.erros.push(`${n.nome}: ${(e as Error).message.slice(0, 160)}`); }
      }
    } catch (e) { st.erros.push(`Notícias: ${(e as Error).message.slice(0, 160)}`); }

    if (!DRY) await runRef.update({ estado: "ok", fim: now(), fontes: run.fontes });
    log("Concluída.", JSON.stringify(run.fontes.map(({ nome, lidos, novos, fundidos, erros }) => ({ nome, lidos, novos, fundidos, erros: erros.length }))));
  } catch (e) {
    if (!DRY) await runRef.update({ estado: "erro", fim: now(), fontes: run.fontes, erroGeral: (e as Error).message });
    throw e;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
