"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { post } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { lerFolha } from "@/lib/xlsx-lite";
import { cadeiaPorDefeito, converterDealflow, dealDaLinha, historicoDaLinha, LinhaDF, startupDaLinha, startupIdDe } from "@/lib/import-dealflow";
import { normNome } from "@/lib/deal-actions";
import { Deal, ETAPAS, Startup } from "@/lib/types";
import { hojeLocal, nowIso } from "@/lib/util";
import { cadeiasParaApi, useAreas, useCategorias } from "@/lib/use-areas";

const LOTE = 8, PARALELO = 3;
type Res = { k: number; site: string; dominio: string; cadeia: string; categoria?: string };
const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/** As fichas do pipeline que já existem e correspondem a esta linha (mesmo nome, mesma referência ou mesmo domínio). */
function iguais(l: LinhaDF, dominio: string, deals: Deal[]) {
  const n = normNome(l.nome);
  return deals.filter((d) => (n && normNome(d.nome) === n) || (!!d.ref && d.ref === l.ref && normNome(d.nome) === n) || (!!dominio && d.dominio === dominio));
}

/**
 * Importa o Excel do dealflow da FCR Sogrape Ventures para o pipeline.
 * Para cada startup pesquisa o site oficial e atribui uma cadeia de valor; as que já existem no pipeline são apagadas e substituídas.
 */
export function ImportDealflow({ deals, email, onClose, onDone }: { deals: Deal[]; email: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [linhas, setLinhas] = useState<LinhaDF[] | null>(null);
  const [nomeFicheiro, setNomeFicheiro] = useState("");
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const [estado, setEstado] = useState<"rever" | "importar" | "feito">("rever");
  const [feitas, setFeitas] = useState(0);
  const [semSite, setSemSite] = useState<string[]>([]);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [subst, setSubst] = useState(0);
  const parar = useRef(false);
  const areas = useAreas();
  const categorias = useCategorias();
  const busy = estado === "importar";

  // Startups do radar que vieram de um import anterior e já não têm ficha no pipeline (por exemplo, depois de apagar o pipeline)
  const [orfas, setOrfas] = useState<Startup[]>([]);
  const [limpando, setLimpando] = useState(false);
  useEffect(() => {
    const ids = new Set(deals.map((d) => d.id));
    getDocs(collection(db, "startups")).then((q) => setOrfas(q.docs.map((d) => ({ id: d.id, ...d.data() }) as Startup)
      .filter((st) => (st.origens || []).some((o) => o.titulo === "Excel do dealflow da Sogrape Ventures") && !(st.dealId && ids.has(st.dealId))))).catch(() => {});
  }, [deals]);
  const limparOrfas = async () => {
    if (!window.confirm(`Apagar do radar de startups as ${orfas.length} startups que vieram do Excel e já não estão no pipeline? Não dá para anular.`)) return;
    setLimpando(true);
    try {
      for (let i = 0; i < orfas.length; i += 50) {
        const lote = orfas.slice(i, i + 50);
        const an = await Promise.all(lote.map((st) => getDocs(collection(db, "startups", st.id, "analises"))));
        const b = writeBatch(db);
        an.forEach((q) => q.docs.forEach((d) => b.delete(d.ref)));
        lote.forEach((st) => b.delete(doc(db, "startups", st.id)));
        await b.commit();
      }
      setOrfas([]);
    } catch (e) { setErro((e as { code?: string }).code === "permission-denied" ? "Sem permissão para apagar startups." : "Não foi possível apagar todas. Tenta outra vez."); }
    setLimpando(false);
  };

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [busy, onClose]);

  const ler = async (f: File | undefined) => {
    if (!f) return;
    setErro(""); setLendo(true); setNomeFicheiro(f.name);
    try {
      const l = converterDealflow(await lerFolha(f, "Dealflow"), hojeLocal());
      if (!l.length) throw new Error("A folha Dealflow não tem startups.");
      setLinhas(l);
    } catch (e) { setErro((e as Error).message || "Não foi possível ler o ficheiro."); setLinhas(null); }
    setLendo(false);
  };

  const resumo = useMemo(() => {
    if (!linhas) return null;
    const porEtapa = ETAPAS.map((e) => ({ e, n: linhas.filter((l) => l.etapa === e.id).length })).filter((x) => x.n);
    const repetidas = linhas.filter((l) => iguais(l, "", deals).length > 0);
    return { porEtapa, repetidas };
  }, [linhas, deals]);

  const importar = async () => {
    if (!linhas) return;
    setEstado("importar"); setFeitas(0); setSemSite([]); setFalhas([]); setSubst(0); parar.current = false;
    // Fotografia do pipeline antes de importar: só estas fichas podem ser substituídas (as que a importação cria não se apagam umas às outras)
    const antes = [...deals];
    const ids = new Set(antes.map((d) => d.id));
    const apagadas = new Set<string>();
    const novas: { id: string; nome: string; descricao: string }[] = [];
    const dealDe = new Map<string, string>();
    let startups: Startup[] = [];
    try { startups = (await getDocs(collection(db, "startups"))).docs.map((d) => ({ id: d.id, ...d.data() }) as Startup); } catch { /* sem ligação ao radar: importa na mesma */ }
    const agora = nowIso();
    const lotes: LinhaDF[][] = [];
    for (let i = 0; i < linhas.length; i += LOTE) lotes.push(linhas.slice(i, i + LOTE));

    const gravar = async (l: LinhaDF, r: Res | undefined) => {
      // Cada startup fica sempre com uma cadeia de valor: a da Gemini ou, se falhar, a que corresponde à vertical do Excel
      const extra = { site: r?.site || "", dominio: r?.dominio || "", cadeia: r?.cadeia || cadeiaPorDefeito(l), categoria: r?.categoria || "" };
      // A cadeia por defeito tem de existir na lista atual; senão, Adjacências ou a última
      if (!areas.some((a) => a.id === extra.cadeia)) extra.cadeia = areas.find((a) => a.id === "adjacencias")?.id || areas[areas.length - 1]?.id || extra.cadeia;
      const velhas = iguais(l, extra.dominio, antes).filter((d) => !apagadas.has(d.id));
      // Mantém a ligação ao radar de startups da ficha substituída
      const ligada = velhas.find((d) => d.startupId);
      const n = normNome(l.nome);
      const st = (ligada?.startupId && startups.find((s) => s.id === ligada.startupId)) || startups.find((s) => (!!extra.dominio && s.dominio === extra.dominio) || (!!n && normNome(s.nome) === n));
      let id = `df-${l.ref}`;
      if (ids.has(id) && !velhas.some((d) => d.id === id)) id = `${id}-xl`;
      // Apaga as fichas repetidas e o histórico delas
      for (const v of velhas) {
        const [hist, an] = await Promise.all([getDocs(collection(db, "deals", v.id, "interacoes")), getDocs(collection(db, "deals", v.id, "analises"))]);
        const b = writeBatch(db);
        hist.docs.forEach((h) => b.delete(h.ref));
        an.docs.forEach((h) => b.delete(h.ref));
        b.delete(doc(db, "deals", v.id));
        await b.commit();
        apagadas.add(v.id);
      }
      if (velhas.length) setSubst((x) => x + 1);
      const deal = dealDaLinha(l, extra, email, agora);
      if (st) deal.startupId = st.id;
      // A análise da ficha do radar continua válida; a da ficha substituída é apagada com ela
      if (st?.analiseResumo) deal.analiseResumo = st.analiseResumo;
      if (!deal.site && st?.site) { deal.site = st.site; deal.dominio = st.dominio; }
      if (!extra.site && deal.site) { extra.site = deal.site; extra.dominio = deal.dominio; }
      // Ponto no radar de startups, no anel da cadeia de valor: liga a ficha que já existe ou cria uma nova (aprovada e ligada ao pipeline)
      const sid = st?.id || startupIdDe(l.nome, extra.dominio);
      deal.startupId = sid;
      const b = writeBatch(db);
      b.set(doc(db, "deals", id), clean(deal));
      historicoDaLinha(l).forEach((h, i) => b.set(doc(db, "deals", id, "interacoes", `xl-${i}`), clean({ ...h, criadoEm: agora })));
      if (st) b.update(doc(db, "startups", st.id), { dealId: id, pipelineEm: agora, atualizadoEm: agora, ...(st.cadeia ? {} : { cadeia: extra.cadeia }), ...(extra.categoria && !categorias.some((c) => c.id === st.setor) ? { setor: extra.categoria } : {}), ...(st.status === "approved" ? {} : { status: "approved", aprovadoEm: agora, aprovadoPor: email }) });
      else { b.set(doc(db, "startups", sid), clean(startupDaLinha(l, extra, id, email, agora))); if (!extra.categoria) { novas.push({ id: sid, nome: l.nome, descricao: l.descricao }); dealDe.set(sid, id); } }
      await b.commit();
      ids.add(id);
      if (!deal.site) setSemSite((x) => [...x, l.nome]);
    };

    const umLote = async (lote: LinhaDF[], base: number) => {
      const pedido = lote.map((l, k) => ({ k: base + k, nome: l.nome, descricao: l.descricao, pais: l.pais, fundadores: l.fundadores }));
      let res: Res[] = [];
      for (let t = 0; t < 2 && !res.length; t++) {
        try { res = (await post<{ startups: Res[] }>("/api/startups/importar", { startups: pedido, cadeias: cadeiasParaApi(areas), categorias: cadeiasParaApi(categorias) })).startups; } catch { /* tenta outra vez; à segunda importa sem site */ }
      }
      for (let k = 0; k < lote.length; k++) {
        try { await gravar(lote[k], res.find((r) => r.k === base + k)); }
        catch (e) { setFalhas((x) => [...x, `${lote[k].nome}: ${(e as { code?: string }).code === "permission-denied" ? "sem permissão para gravar" : (e as Error).message?.slice(0, 80) || "erro"}`]); }
        setFeitas((x) => x + 1);
      }
    };

    for (let i = 0; i < lotes.length && !parar.current; i += PARALELO) {
      await Promise.all(lotes.slice(i, i + PARALELO).map((lote, j) => umLote(lote, (i + j) * LOTE)));
    }
    // Categoria das fichas novas que a pesquisa não conseguiu classificar
    try {
      const cats = cadeiasParaApi(categorias);
      for (let i = 0; cats.length && i < novas.length; i += 80) {
        const j = await post<{ setores: Record<string, string> }>("/api/startups/setores", { startups: novas.slice(i, i + 80), sectors: cats });
        const b = writeBatch(db);
        Object.entries(j.setores).forEach(([id, setor]) => { b.update(doc(db, "startups", id), { setor }); if (dealDe.get(id)) b.update(doc(db, "deals", dealDe.get(id)!), { categoria: setor }); });
        await b.commit();
      }
    } catch { /* a recolha semanal atribui as que faltarem */ }
    setEstado("feito");
  };

  const total = linhas?.length || 0;
  const pct = total ? Math.round((feitas / total) * 100) : 0;

  return (<>
    <div className="scrim" onClick={() => !busy && onClose()} />
    <div className="mdl wide" role="dialog" aria-modal="true" aria-labelledby="imp-t">
      <div className="mdl-h">
        <h2 id="imp-t">Importar o Excel do dealflow</h2>
        <button className="btn icon" aria-label="Fechar" onClick={onClose} disabled={busy}><Icon name="x" /></button>
      </div>
      <div className="mdl-b scroll">
        {estado === "rever" && (<>
          <p className="hint">Escolhe o Excel da FCR Sogrape Ventures (folha «Dealflow»). Cada startup entra no pipeline na fase em que está no Excel. Para cada uma, a Gemini pesquisa o site oficial e atribui uma cadeia de valor e uma categoria, e a startup aparece no radar de startups no anel dessa cadeia. As startups que já estiverem no pipeline são apagadas e substituídas pelas do Excel.</p>
          {orfas.length > 0 && <div className="notice warn scad"><span>Há {orfas.length} startups no radar de startups que vieram de um import anterior e já não têm ficha no pipeline.</span>
            <button className="btn" onClick={limparOrfas} disabled={limpando}>{limpando ? <><span className="spin" aria-hidden="true" />A apagar…</> : <><Icon name="trash" />Apagar do radar</>}</button></div>}
          <label className="impf">
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => ler(e.target.files?.[0])} disabled={lendo} />
            <Icon name="stack" /><span>{lendo ? "A ler o ficheiro…" : nomeFicheiro || "Escolher ficheiro .xlsx"}</span>
          </label>
          {resumo && (<>
            <div className="imps"><b>{total}</b> startups no Excel
              <ul>{resumo.porEtapa.map(({ e, n }) => <li key={e.id}><span>{e.nome}</span><b>{n}</b></li>)}</ul>
            </div>
            {resumo.repetidas.length > 0 && <div className="notice warn"><Icon name="warning-circle" /><span>
              {resumo.repetidas.length} já {resumo.repetidas.length === 1 ? "está" : "estão"} no pipeline e {resumo.repetidas.length === 1 ? "vai ser apagada e substituída" : "vão ser apagadas e substituídas"}: {resumo.repetidas.slice(0, 8).map((l) => l.nome).join(", ")}{resumo.repetidas.length > 8 ? ` e mais ${resumo.repetidas.length - 8}` : ""}. O histórico dessas fichas também é apagado.</span></div>}
            <p className="hint">A pesquisa demora cerca de {Math.max(1, Math.round((total / (LOTE * PARALELO)) * 0.6))} minutos. Mantém esta janela aberta até ao fim.</p>
          </>)}
        </>)}
        {estado !== "rever" && (<>
          <div className="impp" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={feitas} aria-label="Progresso da importação"><i style={{ width: `${pct}%` }} /></div>
          <p className="hint"><b>{feitas}</b> de {total} startups importadas{subst ? `, ${subst} substituídas` : ""}{estado === "importar" ? ". A pesquisar os sites…" : "."}</p>
          {estado === "feito" && semSite.length > 0 && <div className="notice warn"><Icon name="warning-circle" /><span>Sem site oficial encontrado ({semSite.length}): {semSite.slice(0, 20).join(", ")}{semSite.length > 20 ? ` e mais ${semSite.length - 20}` : ""}. Podes juntar o site na ficha.</span></div>}
          {falhas.length > 0 && <p className="gerr" role="alert">Não foram gravadas ({falhas.length}): {falhas.slice(0, 10).join("; ")}{falhas.length > 10 ? "…" : ""}</p>}
        </>)}
        {erro && <p className="gerr" role="alert">{erro}</p>}
      </div>
      <div className="mdl-f">
        <span className="sp" />
        {estado === "rever" && <button className="btn primary" onClick={importar} disabled={!linhas || lendo}><Icon name="tray" />Importar {total || ""} startups</button>}
        {estado === "importar" && <button className="btn" onClick={() => { parar.current = true; }}>Parar depois deste lote</button>}
        {estado === "feito" && <button className="btn primary" onClick={() => onDone(`${feitas - falhas.length} startups importadas do Excel${subst ? `, ${subst} substituídas` : ""}`)}>Fechar</button>}
      </div>
    </div>
  </>);
}

