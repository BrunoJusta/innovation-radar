"use client";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Pager, usePaged } from "@/components/Pager";
import type { RadarItem } from "@/components/radar/RadarApp";
import { layout, RadarChart } from "@/components/radar/RadarChart";
import { dCurta, Hl, SearchBox, ViewToggle } from "@/components/radar/SearchBits";
import { EmLabels, SearchResults, SearchSummary, where } from "@/components/radar/SearchResults";
import { search, SearchDoc, snippet, terms } from "@/lib/search";
import { approveStartup, rejectStartup, startupBackToTriage } from "@/lib/startup-actions";
import { FaseSelect, SectorSelect } from "@/components/CatSelect";
import { post } from "@/lib/api";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Area, Category, FASES, Sector, Startup } from "@/lib/types";
import { useSession } from "../AuthGate";
import { useDeals } from "../pipeline/DealsLookup";
import { cadeiasParaApi } from "@/lib/use-areas";
import { StartupDrawer } from "./StartupDrawer";

type Vista = "radar" | "lista";
type Ordem = "recentes" | "relevancia";
const LS_VISTA = "startups:radar:vista";

/** Como a pesquisa explica onde encontrou a startup. */
const LABELS: EmLabels = { titulo: "nome", resumo: "descrição", entidades: "investidores", area: "cadeia de valor", categoria: "fase", fontes: "origem" };

/**
 * Radar das startups aprovadas: anéis = cadeias de valor (como no radar das notícias), cor = cadeia; a categoria, a fase e o ano são filtros.
 * Igual ao radar das notícias: pesquisa que acende os resultados no radar, vista em lista e paginação.
 */
export function StartupRadar({ areas: cadeias, startups, sectors, loaded }: { areas: Area[]; startups: Startup[]; sectors: Sector[]; loaded: boolean }) {
  const { email } = useSession();
  const [fRing, setFRing] = useState<string | null>(null);
  const [fFase, setFFase] = useState("all");
  const [fSec, setFSec] = useState("all");
  const [fAno, setFAno] = useState(String(new Date().getFullYear()));
  const { deals } = useDeals();
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [view, setViewS] = useState<Vista>("radar");
  const [ordemL, setOrdemL] = useState<Ordem>("recentes");
  const [ordemS, setOrdemS] = useState<Ordem>("relevancia");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const v = localStorage.getItem(LS_VISTA); if (v === "radar" || v === "lista") setViewS(v); } catch { /* sem armazenamento */ }
  }, []);
  const setView = (v: Vista) => { setViewS(v); try { localStorage.setItem(LS_VISTA, v); } catch { /* sem armazenamento */ } };

  // As cadeias de valor fazem de anéis e as fases de "categorias" (para reaproveitar a pesquisa e a lista do radar das notícias)
  const rings = useMemo(() => cadeias.map((x) => ({ id: x.id, nome: x.nome, cor: x.cor })), [cadeias]);
  const areas: Area[] = cadeias;
  const fases: Category[] = useMemo(() => FASES.map((f, i) => ({ id: f.id, nome: f.nome, icone: "chart-line", descricao: f.descricao, ordem: i, palavrasChave: [] })), []);
  const area = useCallback((id: string) => areas.find((a) => a.id === id), [areas]);
  const fase = useCallback((id: string) => fases.find((f) => f.id === id), [fases]);

  const aprovadas = useMemo(() => startups.filter((s) => s.status === "approved"), [startups]);
  // Só entram no radar as que têm cadeia de valor; as outras ficam à espera de serem classificadas
  const comCadeia = useMemo(() => aprovadas.filter((s) => cadeias.some((a) => a.id === s.cadeia)), [aprovadas, cadeias]);
  // Ano: o de entrada no pipeline, quando está lá; senão o ano em que a startup entrou no radar.
  // O ano escolhe que startups entram no radar (não é um realce, por isso não liga os pontos)
  const anoDe = useMemo(() => {
    const m = new Map<string, string>();
    comCadeia.forEach((st) => { const d = deals.find((x) => x.id === st.dealId || x.startupId === st.id); m.set(st.id, (d?.entrada || st.criadoEm || "").slice(0, 4)); });
    return m;
  }, [comCadeia, deals]);
  // O ano atual aparece sempre (é o filtro por defeito), mesmo sem startups
  const anos = useMemo(() => [...new Set([String(new Date().getFullYear()), ...[...anoDe.values()].filter((a) => /^\d{4}$/.test(a))])].sort().reverse(), [anoDe]);
  const approved = useMemo(() => comCadeia.filter((s) => fAno === "all" || anoDe.get(s.id) === fAno), [comCadeia, anoDe, fAno]);
  const semCadeia = useMemo(() => aprovadas.filter((s) => !cadeias.some((a) => a.id === s.cadeia)), [aprovadas, cadeias]);
  const [classificando, setClassificando] = useState(false);
  const classificar = async () => {
    setClassificando(true);
    try {
      let feitas = 0;
      for (let i = 0; i < semCadeia.length; i += 80) {
        const lote = semCadeia.slice(i, i + 80).map((s) => ({ id: s.id, nome: s.nome, descricao: s.descricao, setor: sectors.find((x) => x.id === s.setor)?.nome || "" }));
        const j = await post<{ cadeias: Record<string, string> }>("/api/startups/cadeias", { startups: lote, cadeias: cadeiasParaApi(cadeias) });
        await Promise.all(Object.entries(j.cadeias).map(([id, cadeia]) => updateDoc(doc(db, "startups", id), { cadeia })));
        feitas += Object.keys(j.cadeias).length;
      }
      flash(`Cadeia de valor atribuída a ${feitas} ${feitas === 1 ? "startup" : "startups"}`);
    } catch (e) { flash((e as Error).message || "Não foi possível classificar. Tenta outra vez."); }
    setClassificando(false);
  };
  const items: RadarItem[] = useMemo(() => layout(rings, approved.map((s) => {
    const sec = sectors.find((x) => x.id === s.setor), f = FASES.find((x) => x.id === s.fase), cad = cadeias.find((x) => x.id === s.cadeia);
    return {
      id: s.id, ring: s.cadeia!, area: s.cadeia!, cat: s.fase, group: s.fase, color: cad?.cor || "#94A3B8",
      titulo: s.nome, sub: [sec?.nome, f?.nome].filter(Boolean).join(", "), resumo: [s.descricao, s.porque].filter(Boolean).join("\n\n"),
      entidades: s.investidores || [], fontes: [], data: s.aprovadoEm || s.criadoEm, relevancia: s.relevancia, destaque: s.destaque,
    };
  })), [approved, sectors, rings, cadeias]);
  const byId = useMemo(() => new Map(approved.map((s) => [s.id, s])), [approved]);

  // Pesquisa (nome, descrição, investidores, país, setor e fase)
  const ts = useMemo(() => terms(dq), [dq]);
  const searching = ts.length > 0;
  const docs: SearchDoc[] = useMemo(() => items.map((x) => {
    const s = byId.get(x.id);
    return { id: x.id, titulo: x.titulo, resumo: `${x.resumo} ${s?.pais || ""} ${s?.cidade || ""} ${s?.financiamento || ""}`, entidades: x.entidades,
      fontes: [{ titulo: s?.dominio || "" }], areaNome: `${area(x.area)?.nome || ""} ${sectors.find((y) => y.id === s?.setor)?.nome || ""}`, catNome: fase(x.cat)?.nome || "", relevancia: x.relevancia, data: x.data };
  }), [items, byId, area, fase, sectors]);
  const hits = useMemo(() => (searching ? search(docs, dq) : []), [docs, dq, searching]);
  const hitsById = useMemo(() => new Map(hits.map((h) => [h.id, h])), [hits]);
  const hitSet = useMemo(() => (searching ? new Set(hits.map((h) => h.id)) : null), [hits, searching]);
  const itemById = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);
  const secOf = useCallback((x: RadarItem) => byId.get(x.id)?.setor || "", [byId]);
  /** Setor e fase (os filtros em dropdown); o anel filtra-se à parte. */
  const passaSF = useCallback((x: RadarItem) => (fFase === "all" || x.cat === fFase) && (fSec === "all" || secOf(x) === fSec), [fFase, fSec, secOf]);
  const passa = useCallback((x: RadarItem) => (!fRing || x.area === fRing) && passaSF(x), [fRing, passaSF]);
  const temFiltroSF = fFase !== "all" || fSec !== "all";
  const hitItems = useMemo(() => hits.map((h) => itemById.get(h.id)!).filter(Boolean), [hits, itemById]);
  const results = useMemo(() => hitItems.filter(passa), [hitItems, passa]);
  const byArea = useMemo(() => {
    const o: Record<string, number> = {};
    hitItems.filter(passaSF).forEach((x) => { o[x.area] = (o[x.area] || 0) + 1; });
    return o;
  }, [hitItems, passaSF]);
  const related = useMemo(() => {
    if (!searching) return [];
    const n = new Map<string, number>();
    results.slice(0, 40).forEach((x) => x.entidades.forEach((e) => n.set(e, (n.get(e) || 0) + 1)));
    const qs = dq.trim().toLowerCase();
    return [...n.entries()].filter(([e]) => e.toLowerCase() !== qs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([e]) => e);
  }, [results, searching, dq]);

  // Exemplos e sugestões: investidores mais frequentes, setores e países
  const examples = useMemo(() => {
    const n = new Map<string, number>();
    approved.forEach((s) => [...(s.investidores || []), s.pais].filter(Boolean).forEach((e) => n.set(e, (n.get(e) || 0) + 1)));
    return [...[...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e]) => e), ...cadeias.slice(0, 3).map((s) => s.nome)];
  }, [approved, cadeias]);
  const suggestions: { label: string; icon?: string }[] = useMemo(() => [
    ...cadeias.slice(0, 4).map((a) => ({ label: a.nome })),
    ...examples.slice(0, 5).map((e) => ({ label: e })),
  ], [cadeias, examples]);

  // Lista: filtros, ordem e paginação
  const ordem = searching ? ordemS : ordemL, setOrdem = searching ? setOrdemS : setOrdemL;
  const rows = useMemo(() => {
    const l = searching ? results : items.filter(passa);
    if (ordem === "recentes") return [...l].sort((a, b) => b.data.localeCompare(a.data));
    return searching ? l : [...l].sort((a, b) => b.relevancia - a.relevancia || b.data.localeCompare(a.data));
  }, [searching, results, items, passa, ordem]);
  const pgL = usePaged(rows, `${dq}|${fRing}|${fFase}|${fSec}|${fAno}|${ordem}`);
  const pgR = usePaged(results, `${dq}|${fRing}|${fFase}|${fSec}|${fAno}`);

  const nav = view === "lista" ? pgL.items : pgR.items;
  useEffect(() => setActive(0), [dq, fRing, fFase, fSec, fAno, view, ordem, pgL.page, pgR.page]);
  useEffect(() => {
    if (!searching) return;
    const el = document.getElementById(`sr-${nav[active]?.id}`);
    if (!el) return;
    const box = el.closest(".slist") as HTMLElement | null;
    if (box && box.scrollHeight > box.clientHeight) {
      const top = el.offsetTop - box.offsetTop, bottom = top + el.offsetHeight;
      if (top < box.scrollTop) box.scrollTop = top - 8;
      else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 28;
    } else if (active > 0) el.scrollIntoView({ block: "nearest" });
  }, [active, nav, searching]);
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { if (q) { e.preventDefault(); setQ(""); } else inputRef.current?.blur(); return; }
    if (!searching || !nav.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(nav.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); setOpenId(nav[active]?.id || nav[0].id); }
  };
  const focusId = hover ?? (searching ? nav[active]?.id ?? null : null);

  const counts = (rid: string) => items.filter((x) => x.ring === rid && passaSF(x)).length;
  const faseCount = (fid: string) => items.filter((x) => x.cat === fid && (!fRing || x.area === fRing) && (fSec === "all" || secOf(x) === fSec)).length;
  const secCount = (sid: string) => items.filter((x) => secOf(x) === sid && (!fRing || x.area === fRing) && (fFase === "all" || x.cat === fFase)).length;
  const open = openId ? startups.find((s) => s.id === openId) || null : null;
  const drawerList = (view === "lista" ? rows : searching ? results : items).map((x) => byId.get(x.id)!).filter(Boolean);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const filtros = (<>
    <SectorSelect sectors={sectors} value={fSec} onChange={setFSec} counts={secCount} />
    <FaseSelect fases={[...FASES].reverse()} value={fFase} onChange={setFFase} counts={faseCount} />
    <label className="periodo">
      <span>Ano</span>
      <select value={fAno} onChange={(e) => setFAno(e.target.value)} aria-label="Ano">
        <option value="all">Todos os anos</option>{anos.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </label>
  </>);
  const aviso = semCadeia.length > 0 && (
    <div className="notice warn scad"><span>{semCadeia.length} {semCadeia.length === 1 ? "startup aprovada ainda não tem" : "startups aprovadas ainda não têm"} cadeia de valor e não {semCadeia.length === 1 ? "aparece" : "aparecem"} no radar.</span>
      <button className="btn" onClick={classificar} disabled={classificando}>{classificando ? <><span className="spin" aria-hidden="true" />A classificar…</> : <><Icon name="sparkle" />Atribuir com a Gemini</>}</button></div>
  );
  const summary = (
    <SearchSummary q={dq} n={results.length} total={hits.length} byArea={byArea} areas={areas} fRing={fRing} setFRing={setFRing}
      cat={fFase !== "all" ? fase(fFase) : undefined} clearCat={() => setFFase("all")} related={related} setQ={setQ}
      compact={view === "lista"} noun={["startup", "startups"]} />
  );
  const empty = searching ? (
    <>
      <b>Nenhuma startup para «{dq.trim()}»</b>
      <span>{hits.length ? "Há resultados noutras cadeias de valor, categorias, fases ou anos. Tira os filtros para os veres." : "Experimenta outra palavra, um investidor ou um país."}</span>
      {hits.length ? <button className="chip" onClick={() => { setFRing(null); setFFase("all"); setFSec("all"); setFAno("all"); }}>Tirar filtros</button>
        : <div className="ssc">{suggestions.slice(0, 6).map((s) => <button key={s.label} className="chip" onClick={() => setQ(s.label)}>{s.icon && <Icon name={s.icon} />}{s.label}</button>)}</div>}
    </>
  ) : (
    <><b>Sem startups com estes filtros</b><span>Tira os filtros de cadeia de valor, categoria, fase e ano.</span></>
  );

  return (<>
    <div className="rp rp-embed">
      <section className={`hero${view === "lista" ? " lmode" : ""}${searching ? " smode" : ""}`} aria-label="Radar de startups">
        <div className="htxt"><h1>Radar de startups</h1></div>
        <div className="tools">
          <SearchBox ref={inputRef} q={q} setQ={setQ} examples={examples} suggestions={suggestions} onKey={onKey} kbd={false}
            placeholder="Pesquisar startups" busy={q !== dq} activeId={searching ? nav[active]?.id : undefined} />
          <ViewToggle view={view} setView={setView} />
        </div>
        {view === "radar" ? (
          <>
            <div className="hleg">
              {searching ? (
                <div className="spanel" key="s">
                  {summary}
                  <SearchResults results={pgR.items} hitsById={hitsById} ts={ts} area={area} cat={fase} active={active}
                    setHover={setHover} onOpen={setOpenId} empty={empty} labels={LABELS} />
                  <Pager {...pgR} label="startups" className="pgr-s" />
                </div>
              ) : (
                <>
                  <div className={`legend${fRing ? " filtering" : ""}`} role="group" aria-label="Filtrar por cadeia de valor">
                    {cadeias.map((a) => (
                      <button key={a.id} className="lg" style={{ ["--c" as string]: a.cor }} aria-pressed={fRing === a.id} onClick={() => setFRing(fRing === a.id ? null : a.id)}>
                        <span className="sw" /><b>{a.nome}</b><span className="n">{counts(a.id)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="fline">{filtros}</div>
                  {aviso}
                </>
              )}
            </div>
            <RadarChart rings={rings} items={items} fRing={fRing} fGroup={temFiltroSF ? "sf" : "all"} pass={temFiltroSF ? (x) => passaSF(x as RadarItem) : undefined} regrowKey={searching ? "search" : ""} onOpen={setOpenId}
              state={loaded ? "ok" : "loading"} idPrefix="s" hits={hitSet} focusId={focusId} scanKey={searching ? dq : ""} onHover={setHover}
              center={searching ? { n: results.length, label: results.length === 1 ? "startup" : "startups" } : null}
              emptyTitle="Ainda sem startups aprovadas" emptyText="Aprova startups na triagem e elas aparecem aqui." ariaLabel="Radar das startups aprovadas" />
          </>
        ) : (
          <div className="lv">
            {searching ? summary : (
              <div className="lbar">
                <div className="lareas" role="group" aria-label="Filtrar por cadeia de valor">
                  <button className="chip" aria-pressed={!fRing} onClick={() => setFRing(null)}>Todas as cadeias</button>
                  {cadeias.map((a) => (
                    <button key={a.id} className="chip achip" style={{ ["--c" as string]: a.cor }} aria-pressed={fRing === a.id} onClick={() => setFRing(fRing === a.id ? null : a.id)}>
                      <span className="cdot" />{a.nome}<span className="cn">{counts(a.id)}</span>
                    </button>
                  ))}
                </div>
                <div className="fline">{filtros}</div>
              </div>
            )}
            {aviso}
            <div className="lctl">
              <span className="lcount"><b>{rows.length}</b> {rows.length === 1 ? "startup" : "startups"}</span>
              <span className="sp" />
              <label className="periodo">
                <span>Ordenar</span>
                <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
                  <option value="recentes">Aprovadas mais recentemente</option>
                  <option value="relevancia">{searching ? "Melhor correspondência" : "Mais relevantes"}</option>
                </select>
              </label>
            </div>
            <div ref={pgL.top} className="pgr-anchor" />
            {!loaded ? <div className="snone"><span>A carregar as startups…</span></div> : !rows.length ? <div className="snone">{empty}</div> : (
              <div className="lgroups" id="sres" role={searching ? "listbox" : undefined} aria-label={searching ? "Resultados da pesquisa" : undefined}>
                <ol className="lrows">
                  {pgL.items.map((x, k) => {
                    const s = byId.get(x.id), a = area(x.area), f = FASES.find((y) => y.id === x.cat), h = hitsById.get(x.id);
                    return (
                      <li key={x.id} style={{ ["--c" as string]: x.color, ["--k" as string]: Math.min(k, 14) }}>
                        <button id={`sr-${x.id}`} className={`lrow${searching && k === active ? " act" : ""}`} onClick={() => setOpenId(x.id)}
                          role={searching ? "option" : undefined} aria-selected={searching ? k === active : undefined}>
                          <span className="num">{x.n}</span>
                          <span className="lmain">
                            <span className="ltit"><Hl text={x.titulo} ts={ts} />{s?.dominio && <small className="ldom">{s.dominio}</small>}{x.destaque && <span className="lstar" title="Destaque"><Icon name="star-fill" /></span>}</span>
                            <span className="lres"><Hl text={searching ? snippet(s?.descricao || x.resumo, ts, 220) : s?.descricao || x.resumo} ts={ts} /></span>
                            <span className="lmeta">
                              <span className="lar"><i />{a?.nome}</span>
                              {sectors.find((y) => y.id === s?.setor) && <span className="lca">{sectors.find((y) => y.id === s?.setor)!.nome}</span>}
                              {f && <span className="lca"><span className="scdot" style={{ ["--sc" as string]: f.cor }} />{f.nome}</span>}
                              {s?.pais && <span className="lca"><Icon name="globe" />{s.pais}</span>}
                              {s?.financiamento && <span className="lca">{s.financiamento}</span>}
                              {x.entidades.slice(0, 3).map((e) => <span key={e} className="lent"><Hl text={e} ts={ts} /></span>)}
                              {searching && h && where(h, LABELS) && <span className="swhere">encontrado em {where(h, LABELS)}</span>}
                            </span>
                          </span>
                          <span className="ldate">{dCurta(x.data)}<small>relevância {x.relevancia}</small></span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <Pager {...pgL} label="startups" />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
    {open && (
      <StartupDrawer s={open} list={drawerList} sectors={sectors} areas={cadeias} onClose={() => setOpenId(null)} onNav={setOpenId} notify={flash}
        onApprove={() => approveStartup(open, email).then(() => flash("Aprovada"))}
        onReason={(m) => rejectStartup(open, m).then(() => { setOpenId(null); flash("Rejeitada"); })} onBack={() => startupBackToTriage(open).then(() => { setOpenId(null); flash(`«${open.nome}» voltou à triagem`); })} />
    )}
    {msg && <div className="toast" role="status"><span>{msg}</span></div>}
  </>);
}
