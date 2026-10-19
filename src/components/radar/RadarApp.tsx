"use client";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CatSelect } from "@/components/CatSelect";
import { Icon } from "@/components/Icon";
import { loadPublished, loadStructure } from "@/lib/data";
import { search, SearchDoc, terms } from "@/lib/search";
import { Area, Category, Settings, Signal } from "@/lib/types";
import { quarterKey, quarterLabel } from "@/lib/util";
import { NewsList, Ordem } from "./NewsList";
import { ChartItem, layout, RadarChart, ringRadii } from "./RadarChart";
import { SearchBox, ViewToggle } from "./SearchBits";
import { SearchResults, SearchSummary } from "./SearchResults";
import { SignalModal } from "./SignalModal";

export interface RadarItem extends ChartItem {
  area: string; cat: string;
  resumo: string; entidades: string[]; fontes: { titulo: string; url: string }[];
  data: string; relevancia: number; destaque: boolean;
}

type Vista = "radar" | "lista";
const LS_VISTA = "radar:vista";

/** Radar público. Com `inBo` aparece dentro do backoffice (separador Radar das notícias), sem o cabeçalho do site. */
export default function RadarApp({ inBo = false }: { inBo?: boolean } = {}) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [fRing, setFRing] = useState<string | null>(null);
  const [fCat, setFCat] = useState<string>("all");
  const [period, setPeriod] = useState<string>("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setViewState] = useState<Vista>("radar");
  // Ordem da lista: sem pesquisa começa pelas mais recentes, numa pesquisa pela melhor correspondência
  const [ordemL, setOrdemL] = useState<Ordem>("recentes");
  const [ordemS, setOrdemS] = useState<Ordem>("relevancia");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([loadStructure(), loadPublished()])
      .then(([st, pub]) => { setAreas(st.areas); setCats(st.categories); setSettings(st.settings); setSignals(pub); setState("ok"); })
      .catch((e) => { console.error(e); setState("error"); });
  }, []);

  // Pesquisa e vista no endereço (?q=…&vista=lista) para se poder partilhar o link; a vista fica também guardada no browser
  useEffect(() => {
    let v: string | null = null;
    if (!inBo) {
      const p = new URLSearchParams(location.search);
      if (p.get("q")) setQ(p.get("q")!);
      v = p.get("vista");
    }
    if (!v) try { v = localStorage.getItem(LS_VISTA); } catch { /* sem acesso ao armazenamento */ }
    if (v === "lista" || v === "radar") setViewState(v);
  }, [inBo]);
  const setView = (v: Vista) => {
    setViewState(v);
    try { localStorage.setItem(LS_VISTA, v); } catch { /* sem acesso ao armazenamento */ }
  };
  useEffect(() => {
    if (inBo) return;
    const p = new URLSearchParams(location.search);
    if (dq.trim()) p.set("q", dq.trim()); else p.delete("q");
    if (view === "lista") p.set("vista", "lista"); else p.delete("vista");
    const s = p.toString();
    history.replaceState(null, "", `${location.pathname}${s ? `?${s}` : ""}${location.hash}`);
  }, [dq, view, inBo]);

  // "/" ou Ctrl/⌘+K vão para a pesquisa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable=true]");
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        if (openId) return;
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);

  const quarters = useMemo(() => {
    const set = new Set(signals.map((s) => quarterKey(s.publicado!.dataPublicacao)));
    return [...set].sort().reverse();
  }, [signals]);
  const periodOptions = useMemo(() => [
    { v: "recent", l: `Últimos ${settings?.janelaDias ?? 90} dias` },
    ...quarters.map((x) => ({ v: x, l: quarterLabel(x) })),
    { v: "all", l: "Todo o arquivo" },
  ], [quarters, settings]);

  const area = useCallback((id: string) => areas.find((a) => a.id === id), [areas]);
  const cat = useCallback((id: string) => cats.find((c) => c.id === id), [cats]);

  const ts = useMemo(() => terms(dq), [dq]);
  const searching = ts.length > 0;
  const ordem = searching ? ordemS : ordemL, setOrdem = searching ? setOrdemS : setOrdemL;

  // Notícias com posição no radar: do período escolhido ou, numa pesquisa, de todo o arquivo
  const R = useMemo(() => ringRadii(areas.length), [areas.length]);
  const items: RadarItem[] = useMemo(() => {
    if (!settings) return [];
    const limit = Date.now() - settings.janelaDias * 864e5;
    const inPeriod = signals.filter((s) => {
      if (searching || period === "all") return true;
      const d = s.publicado!.dataPublicacao;
      return period === "recent" ? new Date(d).getTime() >= limit : quarterKey(d) === period;
    });
    const base = inPeriod.map((s) => {
      const p = s.publicado!;
      const a = areas.find((x) => x.id === p.area), c = cats.find((x) => x.id === p.categoria);
      return { id: s.id, ring: p.area, area: p.area, cat: p.categoria, group: p.categoria, color: a?.cor || "#999",
        titulo: p.titulo, sub: `${a?.nome || ""}, ${c?.nome || ""}`, resumo: p.resumo, entidades: p.entidades || [], fontes: p.fontes || [],
        data: p.dataPublicacao, relevancia: p.relevancia, destaque: p.destaque };
    });
    return layout(areas, base);
  }, [signals, areas, cats, settings, period, searching]);

  // Pesquisa
  const docs: SearchDoc[] = useMemo(() => items.map((x) => ({
    id: x.id, titulo: x.titulo, resumo: x.resumo, entidades: x.entidades, fontes: x.fontes,
    areaNome: area(x.area)?.nome || "", catNome: cat(x.cat)?.nome || "", relevancia: x.relevancia, data: x.data,
  })), [items, area, cat]);
  const hits = useMemo(() => (searching ? search(docs, dq) : []), [docs, dq, searching]);
  const hitsById = useMemo(() => new Map(hits.map((h) => [h.id, h])), [hits]);
  const hitSet = useMemo(() => (searching ? new Set(hits.map((h) => h.id)) : null), [hits, searching]);
  const byId = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);
  const passa = useCallback((x: RadarItem) => (!fRing || x.area === fRing) && (fCat === "all" || x.cat === fCat), [fRing, fCat]);
  const hitItems = useMemo(() => hits.map((h) => byId.get(h.id)!).filter(Boolean), [hits, byId]);
  const results = useMemo(() => hitItems.filter(passa), [hitItems, passa]);
  const byArea = useMemo(() => {
    const o: Record<string, number> = {};
    hitItems.filter((x) => fCat === "all" || x.cat === fCat).forEach((x) => { o[x.area] = (o[x.area] || 0) + 1; });
    return o;
  }, [hitItems, fCat]);
  // Entidades que aparecem nos resultados e que ainda não estão na pesquisa: servem para afinar
  const related = useMemo(() => {
    if (!searching) return [];
    const n = new Map<string, number>();
    results.slice(0, 40).forEach((x) => x.entidades.forEach((e) => n.set(e, (n.get(e) || 0) + 1)));
    const qs = dq.trim().toLowerCase();
    return [...n.entries()].filter(([e]) => e.toLowerCase() !== qs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([e]) => e);
  }, [results, searching, dq]);

  // Entidades mais referidas em todo o arquivo: exemplos na caixa e sugestões
  const topEnts = useMemo(() => {
    const n = new Map<string, number>();
    signals.forEach((s) => (s.publicado?.entidades || []).forEach((e) => n.set(e, (n.get(e) || 0) + 1)));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([e]) => e);
  }, [signals]);
  // Categorias com mais notícias (com muitas categorias, só as principais entram nas sugestões)
  const topCats = useMemo(() => {
    const n = new Map<string, number>();
    signals.forEach((s) => { const c = s.publicado?.categoria; if (c) n.set(c, (n.get(c) || 0) + 1); });
    return [...cats].sort((a, b) => (n.get(b.id) || 0) - (n.get(a.id) || 0) || a.ordem - b.ordem).slice(0, 4);
  }, [signals, cats]);
  const examples = useMemo(() => [...topEnts.slice(0, 5), ...topCats.map((c) => c.nome)], [topEnts, topCats]);
  const suggestions: { label: string; icon?: string }[] = useMemo(() => [
    ...topCats.map((c) => ({ label: c.nome, icon: c.icone })),
    ...topEnts.slice(0, 6).map((e) => ({ label: e })),
  ], [topCats, topEnts]);

  // Lista: filtros e ordem
  const rows = useMemo(() => {
    const l = searching ? results : items.filter(passa);
    if (ordem === "recentes") return [...l].sort((a, b) => b.data.localeCompare(a.data));
    return searching ? l : [...l].sort((a, b) => b.relevancia - a.relevancia || b.data.localeCompare(a.data));
  }, [searching, results, items, passa, ordem]);

  const nav = view === "lista" ? rows : results;
  useEffect(() => setActive(0), [dq, fRing, fCat, view, ordem]);
  useEffect(() => {
    if (!searching) return;
    const el = document.getElementById(`sr-${nav[active]?.id}`);
    if (!el) return;
    // Na lista ao lado do radar mexe só no scroll da lista (a página fica parada)
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

  const counts = (aid: string) => items.filter((x) => x.area === aid && (fCat === "all" || x.cat === fCat)).length;
  const catCount = (cid: string) => items.filter((x) => x.cat === cid && (!fRing || x.area === fRing)).length;
  // Ao escolher um anel, a categoria escolhida sai se for de outro anel
  useEffect(() => {
    const c = cats.find((x) => x.id === fCat);
    if (c && fRing && c.area && c.area !== fRing) setFCat("all");
  }, [fRing, fCat, cats]);
  const open = items.find((x) => x.id === openId) || null;
  const cur = cat(fCat);

  const summary = (
    <SearchSummary q={dq} n={results.length} total={hits.length} byArea={byArea} areas={areas} fRing={fRing} setFRing={setFRing}
      cat={fCat !== "all" ? cur : undefined} clearCat={() => setFCat("all")} related={related} setQ={setQ} compact={view === "lista"} />
  );
  const empty = searching ? (
    <>
      <b>Nada no radar para «{dq.trim()}»</b>
      <span>{hits.length ? "Há resultados noutras áreas ou categorias. Tira os filtros para os veres." : "Experimenta outra palavra ou um destes temas:"}</span>
      {hits.length ? (
        <button className="chip" onClick={() => { setFRing(null); setFCat("all"); }}>Tirar filtros</button>
      ) : (
        <div className="ssc">{suggestions.slice(0, 6).map((s) => <button key={s.label} className="chip" onClick={() => setQ(s.label)}>{s.icon && <Icon name={s.icon} />}{s.label}</button>)}</div>
      )}
    </>
  ) : (
    <><b>Sem notícias com estes filtros</b><span>Escolhe outro período ou tira os filtros de área e categoria.</span></>
  );

  return (
    <div className={`rp${inBo ? " rp-embed" : ""}`}>
      {!inBo && <header className="top"><div className="wrap topin"><a className="brand" href="/">Radar de Inovação</a></div></header>}
      <main>
        <section className={`${inBo ? "" : "wrap "}hero${view === "lista" ? " lmode" : ""}${searching ? " smode" : ""}`} aria-label="Radar">
          <div className="htxt">
            <h1>O que está a mudar no vinho</h1>
          </div>
          {/* Pesquisa e vista por cima do radar, à direita do título */}
          <div className="tools">
            <SearchBox ref={inputRef} q={q} setQ={setQ} examples={examples} suggestions={suggestions} onKey={onKey}
              busy={q !== dq} activeId={searching ? nav[active]?.id : undefined} />
            <ViewToggle view={view} setView={setView} />
          </div>
          {view === "radar" ? (
            <>
              <div className="hleg">
                {searching ? (
                  <div className="spanel" key="s">
                    {summary}
                    <SearchResults results={results} hitsById={hitsById} ts={ts} area={area} cat={cat} active={active}
                      setHover={setHover} onOpen={setOpenId} empty={empty} />
                  </div>
                ) : (
                  <>
                    <div className={`legend${fRing ? " filtering" : ""}`} role="group" aria-label="Filtrar por área">
                      {areas.map((a) => (
                        <button key={a.id} className="lg" style={{ ["--c" as string]: a.cor }} aria-pressed={fRing === a.id} onClick={() => setFRing(fRing === a.id ? null : a.id)}>
                          <span className="sw" /><b>{a.nome}</b><span className="n">{counts(a.id)}</span><span className="d">{a.descricao}</span>
                        </button>
                      ))}
                    </div>
                    <div className="fline">
                      <CatSelect cats={cats} areas={areas} value={fCat} onChange={setFCat} area={fRing} counts={catCount} />
                      <label className="periodo">
                        <span>Período</span>
                        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período">
                          {periodOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                      </label>
                    </div>
                  </>
                )}
              </div>
              <RadarChart rings={areas} items={items} fRing={fRing} fGroup={fCat} regrowKey={searching ? "search" : period} onOpen={setOpenId} state={state}
                hits={hitSet} focusId={focusId} scanKey={searching ? dq : ""} onHover={setHover}
                center={searching ? { n: results.length, label: results.length === 1 ? "sinal" : "sinais" } : null}
                emptyTitle="Ainda sem sinais neste período" emptyText="Assim que a equipa de Inovação aprovar notícias, elas aparecem aqui." ariaLabel="Radar com os sinais do período" />
            </>
          ) : (
            <NewsList rows={rows} ts={ts} searching={searching} hitsById={hitsById} areas={areas} cats={cats} fRing={fRing} setFRing={setFRing}
              fCat={fCat} setFCat={setFCat} counts={counts} catCount={catCount} period={period} setPeriod={setPeriod} periodOptions={periodOptions}
              ordem={ordem} setOrdem={setOrdem} active={searching ? active : -1}
              onOpen={setOpenId} setHover={() => {}} summary={summary}
              empty={state === "loading" ? <span>A carregar as notícias…</span> : state === "error" ? <><b>Não foi possível carregar as notícias</b><span>Atualiza a página dentro de alguns minutos.</span></> : empty} />
          )}
        </section>
      </main>
      {open && (
        <SignalModal item={open} items={items} areas={areas} R={R} area={area(open.area)} cat={cat(open.cat)} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
