"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Radar genérico: anéis, pontos, raios, ligações e animações. Usado pelo radar de notícias e pelo de startups. */
export const RMAX = 292;
export const prefersReduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ang = (p: { x: number; y: number }) => ((Math.atan2(p.x, -p.y) * 180) / Math.PI + 360) % 360;

export interface Ring { id: string; nome: string; cor: string }
export interface ChartItem {
  id: string; n: number; ring: string; color: string; group: string; /** Vários grupos (as tags de uma notícia); sem isto vale `group`. */ groups?: string[]; x: number; y: number; titulo: string; sub: string;
  /** Escala do ponto (1 = normal); fica menor quando o anel tem muitos itens. */
  s?: number;
}

/** Raio exterior de cada anel. O expoente < 1 dá mais largura aos anéis de dentro, que têm menos perímetro. */
// Com muitos anéis o expoente aproxima-se de 1, para os de fora não ficarem colados uns aos outros
export const ringRadii = (n: number) => { const e = n >= 6 ? 0.86 : n >= 4 ? 0.78 : 0.7; return Array.from({ length: n }, (_, i) => RMAX * Math.pow((i + 1) / Math.max(n, 1), e)); };

const BASE_R = 9; // raio normal do ponto
const MIN_S = 0.5; // escala mínima
export const SHOW_NUM = 0.85; // abaixo desta escala o número deixa de caber e não é mostrado

/** Número pseudoaleatório estável a partir de um texto: o radar fica igual sempre que se abre. */
function seeded(txt: string) {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) h = Math.imul(h ^ txt.charCodeAt(i), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Posições: cada anel espalha os seus itens de forma irregular (ângulo e distância ao centro com
 * variação estável por item) e depois afasta os que se tocam. Se forem muitos, os pontos encolhem.
 */
export function layout<T extends { id: string; ring: string; relevancia: number }>(rings: Ring[], list: T[]): (T & { x: number; y: number; n: number; s: number })[] {
  const R = ringRadii(rings.length);
  const out: (T & { x: number; y: number; n: number; s: number })[] = [];
  const SPAN = 304, START = 28;                    // arco usado em graus (o topo fica livre para o nome do anel)
  const slot = 2 * BASE_R * 1.2;                     // espaço que um ponto normal ocupa
  let n = 0;
  // Geometria de cada anel e a escala que os pontos teriam nele (área útil a dividir pelos pontos)
  const geo = rings.map((r, ri) => {
    const l = list.filter((x) => x.ring === r.id).sort((a, b) => b.relevancia - a.relevancia);
    const outer = R[ri], inner = ri ? R[ri - 1] : 0;
    const lo = ri ? inner + 0.2 * (outer - inner) : outer * 0.36;
    const hi = ri ? outer - 0.2 * (outer - inner) : outer * 0.8;
    const band = Math.max(0, hi - lo);
    const area = (Math.PI * (hi * hi - lo * lo) * SPAN) / 360 + (band < slot ? 2 * Math.PI * ((lo + hi) / 2) * slot * SPAN / 360 : 0);
    return { l, lo, hi, band, sc: l.length ? Math.max(MIN_S, Math.min(1, Math.sqrt(area / (l.length * slot * slot * 1.5)))) : 1 };
  });
  // Todos os pontos com o mesmo tamanho: o do anel mais cheio
  const scGlobal = Math.min(1, ...geo.map((g) => g.sc));
  rings.forEach((r, ri) => {
    const { l, lo, hi, band } = geo[ri];
    if (!l.length) return;
    const sc = scGlobal;
    const rnd = seeded(`${r.id}:${l.map((x) => x.id).join(",")}`);
    // Ângulos: uma fatia por item, por ordem baralhada, com variação dentro da fatia
    const order = l.map((_, k) => k);
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const a0 = START + (ri ? 17 : 0), a1 = a0 + SPAN;
    const pts = l.map((_, k) => {
      const deg = a0 + (SPAN * (order[k] + 0.5 + (rnd() - 0.5) * 0.8)) / l.length;
      const rad = lo + band * (0.08 + 0.84 * rnd());
      const t = (deg * Math.PI) / 180;
      return { x: rad * Math.sin(t), y: -rad * Math.cos(t) };
    });
    // Afasta os pontos que se tocam, mantendo-os dentro do anel e do arco
    const dmin = 2 * BASE_R * sc * 1.15;
    for (let it = 0; it < 80; it++) {
      let moved = false;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y, d = Math.hypot(dx, dy) || 0.01;
        if (d >= dmin) continue;
        const push = (dmin - d) / 2, ux = dx / d, uy = dy / d;
        pts[i].x -= ux * push; pts[i].y -= uy * push; pts[j].x += ux * push; pts[j].y += uy * push; moved = true;
      }
      for (const p of pts) {
        const rad = Math.min(hi, Math.max(lo, Math.hypot(p.x, p.y)));
        const raw = ((Math.atan2(p.x, -p.y) * 180) / Math.PI + 360) % 360;
        const deg = raw < a0 ? a0 : raw > a1 ? a1 : raw;
        const t = (deg * Math.PI) / 180;
        p.x = rad * Math.sin(t); p.y = -rad * Math.cos(t);
      }
      if (!moved) break;
    }
    l.forEach((x, k) => out.push({ ...x, x: pts[k].x, y: pts[k].y, n: ++n, s: sc }));
  });
  return out;
}

export function RadarChart({ rings, items, fRing, fGroup, regrowKey, onOpen, state, emptyTitle, emptyText, ariaLabel, idPrefix = "r", hits = null, focusId = null, scanKey = "", center = null, onHover, pass }: {
  rings: Ring[]; items: ChartItem[]; fRing: string | null; fGroup: string; regrowKey: string;
  /** Filtro próprio (por exemplo, vários filtros de tags); com ele, `fGroup` só diz se há filtro ativo ("all" = não). */ pass?: (x: ChartItem) => boolean;
  onOpen: (id: string) => void; state: "loading" | "ok" | "error"; emptyTitle: string; emptyText: string; ariaLabel: string; idPrefix?: string;
  /** Pesquisa: só estes itens ficam acesos (os outros apagam-se e os acesos ficam ligados entre si). */
  hits?: Set<string> | null;
  /** Item em destaque (por exemplo, o resultado por cima do qual está o rato). */
  focusId?: string | null;
  /** Muda a cada pesquisa nova: o varrimento passa pelo radar e acende os resultados à medida que lhes toca. */
  scanKey?: string;
  /** Número grande no centro do radar (por exemplo, quantos resultados há). */
  center?: { n: number; label: string } | null;
  onHover?: (id: string | null) => void;
}) {
  const [still, setStill] = useState(false); // movimento reduzido: anéis parados
  useEffect(() => setStill(prefersReduced()), []);
  const [tip, setTip] = useState<{ x: number; y: number; t: string; s: string } | null>(null);
  const R = useMemo(() => ringRadii(rings.length), [rings.length]);
  const match = (x: ChartItem) => (!fRing || x.ring === fRing) && (pass ? pass(x) : fGroup === "all" || (x.groups ? x.groups.includes(fGroup) : x.group === fGroup)) && (!hits || hits.has(x.id));
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
    if (fGroup === "all" && !hits) return [];
    // Em cadeia: cada item liga ao vizinho seguinte à volta do radar (leve e legível com 5 ou com 50)
    const pts = items.filter(match).sort((a, b) => ang(a) - ang(b));
    // Com qualquer filtro ou pesquisa, as ligações só aparecem até 60 pontos: com mais viram um emaranhado
    if (pts.length < 2 || pts.length > 60) return [];
    const pairs: [ChartItem, ChartItem][] = [];
    for (let i = 0; i + 1 < pts.length; i++) pairs.push([pts[i], pts[i + 1]]);
    if (pts.length > 2) pairs.push([pts[pts.length - 1], pts[0]]);
    return pairs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, fGroup, fRing, hits]);
  useEffect(() => {
    if (prefersReduced() || !linksRef.current) return;
    linksRef.current.querySelectorAll("path").forEach((el, n) => {
      const len = (el as SVGPathElement).getTotalLength();
      (el as SVGPathElement).style.strokeDasharray = String(len);
      el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1000, delay: (grew ? 650 : 0) + (hits ? 900 : 0) + n * 45, easing: "cubic-bezier(.65,0,.35,1)", fill: "both" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Só com um anel escolhido: com todos juntos as linhas confundem mais do que ajudam
    if (!fRing) return out;
    items.forEach((x) => {
      if (x.ring !== fRing) return;
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
      <svg ref={svgRef} className={`radar${noanim ? " noanim" : ""}`} viewBox="-310 -310 620 620" role="group" aria-label={ariaLabel}>
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
            <circle style={{ r: R[i] * K }} r={R[i]} fill="none" stroke={`url(#${P}rg${i})`} strokeWidth={2} filter={`url(#${P}glow)`} />
            {/* Órbita pontilhada que roda muito devagar junto a cada anel */}
            <g className="orbit">
              <circle style={{ r: R[i] * K - 9 }} r={R[i] - 9} fill="none" stroke={a.cor} strokeWidth={1.1} strokeDasharray="1.5 9" strokeLinecap="round" opacity={0.45} />
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
        {/* Varrimento da pesquisa: uma volta rápida que acende os resultados quando passa por eles */}
        {hits && scanKey && !still && (
          <g key={scanKey} className="scan" aria-hidden="true">
            <circle r={RMAX * Kfinal} fill="none" stroke="none" />
            <defs>
              <linearGradient id={`${P}scan`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity=".28" />
              </linearGradient>
            </defs>
            <path d={`M0 0 L${(-Math.sin(Math.PI / 4) * RMAX * Kfinal).toFixed(1)} ${(-Math.cos(Math.PI / 4) * RMAX * Kfinal).toFixed(1)} A${RMAX * Kfinal} ${RMAX * Kfinal} 0 0 1 0 ${-RMAX * Kfinal} Z`} fill={`url(#${P}scan)`} />
            <line x1={0} y1={0} x2={0} y2={-RMAX * Kfinal} stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
          </g>
        )}
        {center && (
          <g className="rcenter" aria-hidden="true" key={`c${scanKey}`}>
            <circle r={34} fill="#fff" opacity={0.92} />
            <text className="cn" y={6} textAnchor="middle">{center.n}</text>
            <text className="cl" y={21} textAnchor="middle">{center.label}</text>
          </g>
        )}
        <g className="links" ref={linksRef}>
          {links.map(([p, q], n) => (
            <path key={`${p.id}-${q.id}-${grew}`} d={`M${(p.x * K).toFixed(1)} ${(p.y * K).toFixed(1)} Q${((p.x + q.x) * K * 0.18).toFixed(1)} ${((p.y + q.y) * K * 0.18).toFixed(1)} ${(q.x * K).toFixed(1)} ${(q.y * K).toFixed(1)}`} stroke={`url(#${P}lg${n})`} />
          ))}
        </g>
        {items.map((x, k) => {
          const c = x.color, off = !!fRing && x.ring !== fRing, on = match(x);
          const hit = !!hits && on, focus = focusId === x.id;
          // Ao filtrar um anel, os pontos voltam ao tamanho normal (há espaço para isso)
          const sc = fRing && x.ring === fRing ? Math.min(1, (x.s ?? 1) * K) : x.s ?? 1;
          const stagger = (k * Math.min(1, 14 / Math.max(items.length, 1))).toFixed(2); // a entrada demora sempre menos de 1 s
          return (
            <g key={x.id} className={`bw${off ? " off" : ""}${!on ? " dim" : ""}${hits && !on ? " miss" : ""}${focus ? " focus" : ""}`} style={{ transform: `translate(${(x.x * K).toFixed(1)}px, ${(x.y * K).toFixed(1)}px)` }}>
              {hit && <circle key={`h${scanKey}`} className="beacon" r={10 * sc} fill="none" stroke={c} strokeWidth={2.5} style={{ ["--d" as string]: `${((ang(x) / 360) * 1.1).toFixed(2)}s` }} />}
              <circle className="rip" r={10 * sc} fill="none" stroke={c} strokeWidth={2} data-rip={x.id} />
              <g className={`blip${(fGroup !== "all" || hits) && on ? " link" : ""}${hit ? " hit" : ""}`} tabIndex={hits && !on ? -1 : 0} role="button" style={{ ["--i" as string]: stagger, ["--d" as string]: `${((ang(x) / 360) * 1.1).toFixed(2)}s` }}
                aria-label={`${x.n}. ${x.titulo}`}
                onMouseEnter={(e) => { showTip(e, x); onHover?.(x.id); }} onMouseLeave={() => { setTip(null); onHover?.(null); }} onFocus={(e) => showTip(e, x)} onBlur={() => setTip(null)}
                onClick={() => onOpen(x.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(x.id); } }}>
                <circle className="halo" r={14 * sc} fill={c} opacity={0.18} />
                <circle className="dot" r={BASE_R * sc} fill={c} filter={`url(#${P}glow)`} />
                {sc >= SHOW_NUM && <text textAnchor="middle" y={3} fill="#fff">{x.n}</text>}
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
