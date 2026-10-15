"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Radar genérico: anéis, pontos, raios, ligações e animações. Usado pelo radar de notícias e pelo de startups. */
export const RMAX = 292;
export const prefersReduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ang = (p: { x: number; y: number }) => ((Math.atan2(p.x, -p.y) * 180) / Math.PI + 360) % 360;

export interface Ring { id: string; nome: string; cor: string }
export interface ChartItem { id: string; n: number; ring: string; color: string; group: string; x: number; y: number; titulo: string; sub: string }

export const ringRadii = (n: number) => Array.from({ length: n }, (_, i) => (RMAX * (i + 1)) / Math.max(n, 1));

/** Posições: cada anel distribui os seus itens à volta, os mais relevantes primeiro. */
export function layout<T extends { ring: string; relevancia: number }>(rings: Ring[], list: T[]): (T & { x: number; y: number; n: number })[] {
  const R = ringRadii(rings.length);
  const out: (T & { x: number; y: number; n: number })[] = [];
  let n = 0;
  rings.forEach((r, ri) => {
    const l = list.filter((x) => x.ring === r.id).sort((a, b) => b.relevancia - a.relevancia);
    const inner = ri ? R[ri - 1] : 0, outer = R[ri];
    l.forEach((x, k) => {
      const t = ((28 + (304 * (k + 0.5)) / l.length + (ri ? 17 : 0)) * Math.PI) / 180;
      const rr = ri === 0 ? outer * (k % 2 ? 0.42 : 0.7) : inner + (outer - inner) * (k % 2 ? 0.36 : 0.64);
      out.push({ ...x, x: rr * Math.sin(t), y: -rr * Math.cos(t), n: ++n });
    });
  });
  return out;
}

export function RadarChart({ rings, items, fRing, fGroup, regrowKey, onOpen, state, emptyTitle, emptyText, ariaLabel, idPrefix = "r" }: {
  rings: Ring[]; items: ChartItem[]; fRing: string | null; fGroup: string; regrowKey: string;
  onOpen: (id: string) => void; state: "loading" | "ok" | "error"; emptyTitle: string; emptyText: string; ariaLabel: string; idPrefix?: string;
}) {
  const [still, setStill] = useState(false); // movimento reduzido: anéis parados
  useEffect(() => setStill(prefersReduced()), []);
  const [tip, setTip] = useState<{ x: number; y: number; t: string; s: string } | null>(null);
  const R = useMemo(() => ringRadii(rings.length), [rings.length]);
  const match = (x: ChartItem) => (!fRing || x.ring === fRing) && (fGroup === "all" || x.group === fGroup);
  const P = idPrefix;

  // O círculo entra sempre a crescer: escala menor sem transição e depois o tamanho final
  const ri = fRing ? rings.findIndex((a) => a.id === fRing) : -1;
  const Kfinal = ri >= 0 ? RMAX / R[ri] : 1;
  const [K, setK] = useState(1);
  const [noanim, setNoanim] = useState(false);
  const [grew, setGrew] = useState(0);
  const lastKey = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    const key = `${fRing}|${regrowKey}`;
    const changed = lastKey.current !== undefined && lastKey.current !== key;
    lastKey.current = key;
    if (changed && !prefersReduced()) {
      setNoanim(true); setK(Kfinal * 0.4);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => { setNoanim(false); setK(Kfinal); setGrew((g) => g + 1); }));
      return () => cancelAnimationFrame(r);
    }
    setK(Kfinal);
  }, [Kfinal, fRing, regrowKey]);

  // Ligações entre itens do mesmo grupo (categoria ou setor)
  const linksRef = useRef<SVGGElement>(null);
  const links = useMemo(() => {
    if (fGroup === "all") return [];
    const pts = items.filter(match).sort((a, b) => ang(a) - ang(b));
    const pairs: [ChartItem, ChartItem][] = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) pairs.push([pts[i], pts[j]]);
    return pairs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, fGroup, fRing]);
  useEffect(() => {
    if (prefersReduced() || !linksRef.current) return;
    linksRef.current.querySelectorAll("path").forEach((el, n) => {
      const len = (el as SVGPathElement).getTotalLength();
      (el as SVGPathElement).style.strokeDasharray = String(len);
      el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1000, delay: (grew ? 650 : 0) + n * 45, easing: "cubic-bezier(.65,0,.35,1)", fill: "both" });
    });
  }, [links, grew]);

  // Pulsação contínua: cada ponto solta uma onda à vez, numa volta de 9 s
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

  // Raios pontilhados por item
  const rays = useMemo(() => {
    const out: { cx: number; cy: number; c: string; o: number }[] = [];
    items.forEach((x) => {
      if (fRing && x.ring !== fRing) return;
      const L = Math.hypot(x.x, x.y) * Kfinal, t = Math.atan2(x.x, -x.y), on = match(x);
      for (let r = 46; r < L - 16; r += 13) out.push({ cx: Math.sin(t) * r, cy: -Math.cos(t) * r, c: x.color, o: on ? 0.25 + (0.6 * r) / L : 0.08 });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, fRing, fGroup, Kfinal]);

  const boxRef = useRef<HTMLDivElement>(null);
  const showTip = (e: React.SyntheticEvent<SVGGElement>, x: ChartItem) => {
    const br = (e.currentTarget as SVGGElement).getBoundingClientRect(), bb = boxRef.current!.getBoundingClientRect();
    setTip({ x: br.left + br.width / 2 - bb.left, y: br.top - bb.top, t: x.titulo, s: x.sub });
  };

  return (
    <div className="rbox" ref={boxRef}>
      <svg ref={svgRef} className={`radar${noanim ? " noanim" : ""}`} viewBox="-310 -310 620 620" role="img" aria-label={ariaLabel}>
        <defs>
          <filter id={`${P}glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          {/* Brilho que dá a volta aos anéis devagar: movimento contínuo, sem pulsar */}
          {rings.map((a, i) => (
            <linearGradient key={a.id} id={`${P}rg${i}`} x1="0" y1="0" x2="1" y2="0">
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
            <linearGradient key={n} id={`${P}lg${n}`} gradientUnits="userSpaceOnUse" x1={p.x * K} y1={p.y * K} x2={q.x * K} y2={q.y * K}>
              <stop offset="0" stopColor={p.color} /><stop offset="1" stopColor={q.color} />
            </linearGradient>
          ))}
        </defs>
        <g id={`${P}rays`}>{rays.map((d, i) => <circle key={i} cx={d.cx.toFixed(1)} cy={d.cy.toFixed(1)} r={2.3} fill={d.c} opacity={d.o.toFixed(2)} />)}</g>
        {[...rings].map((a, i) => ({ a, i })).reverse().map(({ a, i }) => (
          <g key={a.id} className={`ringg${fRing && a.id !== fRing ? " off" : ""}`}>
            <circle style={{ r: R[i] * K }} r={R[i]} fill={`color-mix(in srgb, ${a.cor} 3%, transparent)`} />
            <circle style={{ r: R[i] * K }} r={R[i]} fill="none" stroke={`url(#${P}rg${i})`} strokeWidth={3} filter={`url(#${P}glow)`} />
            {/* Órbita pontilhada que roda muito devagar junto a cada anel */}
            <g className="orbit">
              <circle style={{ r: R[i] * K - 9 }} r={R[i] - 9} fill="none" stroke={a.cor} strokeWidth={1.4} strokeDasharray="1.5 9" strokeLinecap="round" opacity={0.45} />
              {!still && <animateTransform attributeName="transform" type="rotate" from={i % 2 ? "0 0 0" : "360 0 0"} to={i % 2 ? "360 0 0" : "0 0 0"} dur={`${90 + i * 30}s`} repeatCount="indefinite" />}
            </g>
          </g>
        ))}
        {rings.map((a, i) => {
          const w = a.nome.length * 7.4 + 28;
          return (
            <g key={a.id} className={`rlab${fRing && a.id !== fRing ? " off" : ""}`} style={{ transform: `translate(0px, ${-R[i] * K}px)` }}>
              <rect x={-w / 2} y={-13} width={w} height={26} rx={13} fill={a.cor} />
              <text className="ring-l" x={0} y={4.5} textAnchor="middle" fill="#fff">{a.nome}</text>
            </g>
          );
        })}
        <g className="links" ref={linksRef}>
          {links.map(([p, q], n) => (
            <path key={`${p.id}-${q.id}-${grew}`} d={`M${(p.x * K).toFixed(1)} ${(p.y * K).toFixed(1)} Q${((p.x + q.x) * K * 0.18).toFixed(1)} ${((p.y + q.y) * K * 0.18).toFixed(1)} ${(q.x * K).toFixed(1)} ${(q.y * K).toFixed(1)}`} stroke={`url(#${P}lg${n})`} />
          ))}
        </g>
        {items.map((x, k) => {
          const c = x.color, off = !!fRing && x.ring !== fRing, on = match(x);
          return (
            <g key={x.id} className={`bw${off ? " off" : ""}${!on ? " dim" : ""}`} style={{ transform: `translate(${(x.x * K).toFixed(1)}px, ${(x.y * K).toFixed(1)}px)` }}>
              <circle className="rip" r={14} fill="none" stroke={c} strokeWidth={2} data-rip={x.id} />
              <g className={`blip${fGroup !== "all" && on ? " link" : ""}`} tabIndex={0} role="button" style={{ ["--i" as string]: k }}
                aria-label={`${x.n}. ${x.titulo}`}
                onMouseEnter={(e) => showTip(e, x)} onMouseLeave={() => setTip(null)} onFocus={(e) => showTip(e, x)} onBlur={() => setTip(null)}
                onClick={() => onOpen(x.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(x.id); } }}>
                <circle className="halo" r={20} fill={c} opacity={0.18} />
                <circle className="dot" r={13} fill={c} filter={`url(#${P}glow)`} />
                <text textAnchor="middle" y={4} fill="#fff">{x.n}</text>
              </g>
            </g>
          );
        })}
      </svg>
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.t}<small>{tip.s}</small></div>}
      {state === "ok" && items.length === 0 && <div className="rempty"><b>{emptyTitle}</b><span>{emptyText}</span></div>}
      {state === "loading" && <div className="rempty"><span>A carregar o radar…</span></div>}
      {state === "error" && <div className="rempty"><b>Não foi possível carregar o radar</b><span>Atualiza a página dentro de alguns minutos.</span></div>}
    </div>
  );
}
