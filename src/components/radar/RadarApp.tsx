"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { loadPublished, loadStructure } from "@/lib/data";
import { Area, Category, Settings, Signal } from "@/lib/types";
import { quarterKey, quarterLabel } from "@/lib/util";
import { SignalModal } from "./SignalModal";

const RMAX = 292;
const prefersReduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface RadarItem {
  id: string; n: number; area: string; cat: string; x: number; y: number;
  titulo: string; resumo: string; entidades: string[]; fontes: { titulo: string; url: string }[];
  data: string; relevancia: number; destaque: boolean;
}

const ang = (p: { x: number; y: number }) => ((Math.atan2(p.x, -p.y) * 180) / Math.PI + 360) % 360;

export default function RadarApp() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [still, setStill] = useState(false); // movimento reduzido: anéis parados
  useEffect(() => setStill(prefersReduced()), []);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [fRing, setFRing] = useState<string | null>(null);
  const [fCat, setFCat] = useState<string>("all");
  const [period, setPeriod] = useState<string>("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; t: string; s: string } | null>(null);

  useEffect(() => {
    Promise.all([loadStructure(), loadPublished()])
      .then(([st, pub]) => { setAreas(st.areas); setCats(st.categories); setSettings(st.settings); setSignals(pub); setState("ok"); })
      .catch((e) => { console.error(e); setState("error"); });
  }, []);

  const quarters = useMemo(() => {
    const set = new Set(signals.map((s) => quarterKey(s.publicado!.dataPublicacao)));
    return [...set].sort().reverse();
  }, [signals]);

  // Notícias do período escolhido, com posição no radar
  const R = useMemo(() => areas.map((_, i) => (RMAX * (i + 1)) / Math.max(areas.length, 1)), [areas]);
  const items: RadarItem[] = useMemo(() => {
    if (!settings) return [];
    const limit = Date.now() - settings.janelaDias * 864e5;
    const inPeriod = signals.filter((s) => {
      const d = s.publicado!.dataPublicacao;
      return period === "recent" ? new Date(d).getTime() >= limit : quarterKey(d) === period;
    });
    const out: RadarItem[] = [];
    let n = 0;
    areas.forEach((a, ri) => {
      const list = inPeriod.filter((s) => s.publicado!.area === a.id).sort((x, y) => y.publicado!.relevancia - x.publicado!.relevancia);
      const inner = ri ? R[ri - 1] : 0, outer = R[ri];
      list.forEach((s, k) => {
        const t = ((28 + (304 * (k + 0.5)) / list.length + (ri ? 17 : 0)) * Math.PI) / 180;
        const rr = ri === 0 ? outer * (k % 2 ? 0.42 : 0.7) : inner + (outer - inner) * (k % 2 ? 0.36 : 0.64);
        const p = s.publicado!;
        out.push({ id: s.id, n: ++n, area: a.id, cat: p.categoria, x: rr * Math.sin(t), y: -rr * Math.cos(t),
          titulo: p.titulo, resumo: p.resumo, entidades: p.entidades || [], fontes: p.fontes || [], data: p.dataPublicacao,
          relevancia: p.relevancia, destaque: p.destaque });
      });
    });
    return out;
  }, [signals, areas, settings, period, R]);

  const area = (id: string) => areas.find((a) => a.id === id);
  const cat = (id: string) => cats.find((c) => c.id === id);
  const match = (x: RadarItem) => (!fRing || x.area === fRing) && (fCat === "all" || x.cat === fCat);

  // O círculo entra sempre a crescer: escala menor sem transição e depois o tamanho final
  const ri = fRing ? areas.findIndex((a) => a.id === fRing) : -1;
  const Kfinal = ri >= 0 ? RMAX / R[ri] : 1;
  const [K, setK] = useState(1);
  const [noanim, setNoanim] = useState(false);
  const [grew, setGrew] = useState(0);
  const lastKey = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    const key = `${fRing}|${period}`;
    const changed = lastKey.current !== undefined && lastKey.current !== key;
    lastKey.current = key;
    if (changed && !prefersReduced()) {
      setNoanim(true); setK(Kfinal * 0.4);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => { setNoanim(false); setK(Kfinal); setGrew((g) => g + 1); }));
      return () => cancelAnimationFrame(r);
    }
    setK(Kfinal);
  }, [Kfinal, fRing, period]);

  // Ligações entre sinais da mesma categoria
  const linksRef = useRef<SVGGElement>(null);
  const links = useMemo(() => {
    if (fCat === "all") return [];
    const pts = items.filter(match).sort((a, b) => ang(a) - ang(b));
    const pairs: [RadarItem, RadarItem][] = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) pairs.push([pts[i], pts[j]]);
    return pairs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, fCat, fRing]);
  useEffect(() => {
    if (prefersReduced() || !linksRef.current) return;
    linksRef.current.querySelectorAll("path").forEach((el, n) => {
      const len = (el as SVGPathElement).getTotalLength();
      (el as SVGPathElement).style.strokeDasharray = String(len);
      el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1000, delay: (grew ? 650 : 0) + n * 45, easing: "cubic-bezier(.65,0,.35,1)", fill: "both" });
    });
  }, [links, grew]);

  // Pulsação contínua: cada sinal solta uma onda à vez, numa volta de 9 s
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (prefersReduced() || !items.length) return;
    const PER = 9000; let prev: number | null = null; let raf = 0;
    const A = items.map((x) => ({ id: x.id, a: ang(x) }));
    const step = (t: number) => {
      const a = ((t % PER) / PER) * 360;
      if (prev !== null) A.forEach((o) => {
        const hit = prev! <= a ? o.a > prev! && o.a <= a : o.a > prev! || o.a <= a;
        if (hit) {
          const r = svgRef.current?.querySelector(`[data-rip="${o.id}"]`) as SVGCircleElement | null;
          const g = r?.closest(".bw");
          if (r && g && !g.classList.contains("dim") && !g.classList.contains("off")) { r.classList.remove("go"); void r.getBBox(); r.classList.add("go"); }
        }
      });
      prev = a; raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  // Raios pontilhados por sinal
  const rays = useMemo(() => {
    const out: { cx: number; cy: number; c: string; o: number }[] = [];
    items.forEach((x) => {
      if (fRing && x.area !== fRing) return;
      const L = Math.hypot(x.x, x.y) * Kfinal, t = Math.atan2(x.x, -x.y), on = match(x);
      for (let r = 46; r < L - 16; r += 13) out.push({ cx: Math.sin(t) * r, cy: -Math.cos(t) * r, c: area(x.area)?.cor || "#999", o: on ? 0.25 + (0.6 * r) / L : 0.08 });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, fRing, fCat, Kfinal]);

  const boxRef = useRef<HTMLDivElement>(null);
  const showTip = (e: React.SyntheticEvent<SVGGElement>, x: RadarItem) => {
    const br = (e.currentTarget as SVGGElement).getBoundingClientRect(), bb = boxRef.current!.getBoundingClientRect();
    setTip({ x: br.left + br.width / 2 - bb.left, y: br.top - bb.top, t: x.titulo, s: `${area(x.area)?.nome || ""}, ${cat(x.cat)?.nome || ""}` });
  };

  const counts = (aid: string) => items.filter((x) => x.area === aid && (fCat === "all" || x.cat === fCat)).length;
  const open = items.find((x) => x.id === openId) || null;

  return (
    <div className="rp">
      <header className="top"><div className="wrap topin"><a className="brand" href="/">Radar de Inovação</a></div></header>
      <main>
        <section className="wrap hero" aria-label="Radar">
          <div className="htxt">
            <h1>O que está a mudar no vinho</h1>
            <p className="sub">Sinais escolhidos pela equipa de Inovação, organizados por área para cada equipa encontrar o que lhe interessa.</p>
          </div>
          <div className="hleg">
            <div className={`legend${fRing ? " filtering" : ""}`} role="group" aria-label="Filtrar por área">
              {areas.map((a) => (
                <button key={a.id} className="lg" style={{ ["--c" as string]: a.cor }} aria-pressed={fRing === a.id} onClick={() => setFRing(fRing === a.id ? null : a.id)}>
                  <span className="sw" /><b>{a.nome}</b><span className="n">{counts(a.id)}</span><span className="d">{a.descricao}</span>
                </button>
              ))}
            </div>
            <div className="cats" role="group" aria-label="Filtrar por categoria">
              <button className="chip" aria-pressed={fCat === "all"} onClick={() => setFCat("all")}>Todas as categorias</button>
              {cats.map((c) => (
                <button key={c.id} className="chip" aria-pressed={fCat === c.id} onClick={() => setFCat(c.id)}><Icon name={c.icone} />{c.nome}</button>
              ))}
            </div>
            <label className="periodo">
              <span>Período</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período">
                <option value="recent">Últimos {settings?.janelaDias ?? 90} dias</option>
                {quarters.map((q) => <option key={q} value={q}>{quarterLabel(q)}</option>)}
              </select>
            </label>
          </div>
          <div className="rbox" ref={boxRef}>
            <svg ref={svgRef} className={`radar${noanim ? " noanim" : ""}`} viewBox="-310 -310 620 620" role="img" aria-label="Radar com os sinais do período">
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                {/* Brilho que dá a volta aos anéis devagar: movimento contínuo, sem pulsar */}
                {areas.map((a, i) => (
                  <linearGradient key={a.id} id={`rg${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" style={{ stopColor: a.cor }} />
                    <stop offset="0.3" style={{ stopColor: a.cor }} />
                    <stop offset="0.5" style={{ stopColor: `color-mix(in srgb, ${a.cor} 25%, #ffffff)` }} />
                    <stop offset="0.7" style={{ stopColor: a.cor }} />
                    <stop offset="1" style={{ stopColor: a.cor }} />
                    {!still && <animateTransform attributeName="gradientTransform" type="rotate"
                      from={i % 2 ? "360 .5 .5" : "0 .5 .5"} to={i % 2 ? "0 .5 .5" : "360 .5 .5"} dur={`${26 + i * 8}s`} repeatCount="indefinite" />}
                  </linearGradient>
                ))}
                {links.map(([p, q], n) => (
                  <linearGradient key={n} id={`lg${n}`} gradientUnits="userSpaceOnUse" x1={p.x * K} y1={p.y * K} x2={q.x * K} y2={q.y * K}>
                    <stop offset="0" stopColor={area(p.area)?.cor} /><stop offset="1" stopColor={area(q.area)?.cor} />
                  </linearGradient>
                ))}
              </defs>
              <g id="rays">{rays.map((d, i) => <circle key={i} cx={d.cx.toFixed(1)} cy={d.cy.toFixed(1)} r={2.3} fill={d.c} opacity={d.o.toFixed(2)} />)}</g>
              {[...areas].map((a, i) => ({ a, i })).reverse().map(({ a, i }) => (
                <g key={a.id} className={`ringg${fRing && a.id !== fRing ? " off" : ""}`}>
                  <circle style={{ r: R[i] * K }} r={R[i]} fill={`color-mix(in srgb, ${a.cor} 3%, transparent)`} />
                  <circle style={{ r: R[i] * K }} r={R[i]} fill="none" stroke={`url(#rg${i})`} strokeWidth={3} filter="url(#glow)" />
                  {/* Órbita pontilhada que roda muito devagar junto a cada anel */}
                  <g className="orbit">
                    <circle style={{ r: R[i] * K - 9 }} r={R[i] - 9} fill="none" stroke={a.cor} strokeWidth={1.4} strokeDasharray="1.5 9" strokeLinecap="round" opacity={0.45} />
                    {!still && <animateTransform attributeName="transform" type="rotate" from={i % 2 ? "0 0 0" : "360 0 0"} to={i % 2 ? "360 0 0" : "0 0 0"} dur={`${90 + i * 30}s`} repeatCount="indefinite" />}
                  </g>
                </g>
              ))}
              {areas.map((a, i) => {
                const w = a.nome.length * 7.4 + 28;
                return (
                  <g key={a.id} className={`rlab${fRing && a.id !== fRing ? " off" : ""}`} style={{ transform: `translate(0px, ${-R[i] * K}px)` }}>
                    <rect x={-w / 2} y={-13} width={w} height={26} rx={13} fill={a.cor} />
                    <text className="ring-l" x={0} y={4.5} textAnchor="middle" fill="#fff">{a.nome}</text>
                  </g>
                );
              })}
              <g id="links" ref={linksRef}>
                {links.map(([p, q], n) => (
                  <path key={`${p.id}-${q.id}-${grew}`} d={`M${(p.x * K).toFixed(1)} ${(p.y * K).toFixed(1)} Q${((p.x + q.x) * K * 0.18).toFixed(1)} ${((p.y + q.y) * K * 0.18).toFixed(1)} ${(q.x * K).toFixed(1)} ${(q.y * K).toFixed(1)}`} stroke={`url(#lg${n})`} />
                ))}
              </g>
              {items.map((x, k) => {
                const c = area(x.area)?.cor || "#999", off = !!fRing && x.area !== fRing, on = match(x);
                return (
                  <g key={x.id} className={`bw${off ? " off" : ""}${!on ? " dim" : ""}`} style={{ transform: `translate(${(x.x * K).toFixed(1)}px, ${(x.y * K).toFixed(1)}px)` }}>
                    <circle className="rip" r={14} fill="none" stroke={c} strokeWidth={2} data-rip={x.id} />
                    <g className={`blip${fCat !== "all" && on ? " link" : ""}`} tabIndex={0} role="button" style={{ ["--i" as string]: k }}
                      aria-label={`${x.n}. ${x.titulo}`}
                      onMouseEnter={(e) => showTip(e, x)} onMouseLeave={() => setTip(null)} onFocus={(e) => showTip(e, x)} onBlur={() => setTip(null)}
                      onClick={() => setOpenId(x.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(x.id); } }}>
                      <circle className="halo" r={20} fill={c} opacity={0.18} />
                      <circle className="dot" r={13} fill={c} filter="url(#glow)" />
                      <text textAnchor="middle" y={4} fill="#fff">{x.n}</text>
                    </g>
                  </g>
                );
              })}
            </svg>
            {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.t}<small>{tip.s}</small></div>}
            {state === "ok" && items.length === 0 && (
              <div className="rempty"><b>Ainda sem sinais neste período</b><span>Assim que a equipa de Inovação aprovar notícias, elas aparecem aqui.</span></div>
            )}
            {state === "loading" && <div className="rempty"><span>A carregar o radar…</span></div>}
            {state === "error" && <div className="rempty"><b>Não foi possível carregar o radar</b><span>Atualiza a página dentro de alguns minutos.</span></div>}
          </div>
        </section>
      </main>
      {open && (
        <SignalModal item={open} items={items} areas={areas} R={R} area={area(open.area)} cat={cat(open.cat)} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
