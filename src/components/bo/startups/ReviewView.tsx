"use client";
import { useEffect, useMemo, useState } from "react";
import { Deal, ETAPAS, emCurso } from "@/lib/types";
import { bandeira, bandeiraDe } from "@/lib/paises";
import { useAreas, useCategorias } from "@/lib/use-areas";
import { DealDrawer } from "../pipeline/DealDrawer";
import { Icon } from "@/components/Icon";
import { lerPais } from "@/lib/paises";
import { useDeals } from "../pipeline/DealsLookup";

/** Azul sequencial (claro = pouco, escuro = muito). O 250 é o mais claro que ainda se distingue do fundo. */
/** Escala em ferrugem (a cor da Sogrape, #B15533): claro = poucas startups, escuro = muitas. */
const AZUL = ["#F2D6C8", "#E3AB8F", "#CC7D5A", "#B15533", "#7F3A22"];
const ZERO = "#ECECEC";

const idx = (e: string | null | undefined) => Math.max(0, ETAPAS.findIndex((x) => x.id === e));
/** Fase mais avançada a que a startup chegou (uma arquivada ou no radar conta até onde estava; uma investida passou por todas). */
const chegou = (d: Deal) => d.etapa === "arquivada" ? idx(d.arquivo?.etapaAnterior || "fit") : d.etapa === "radar" ? idx(d.etapaAnterior || "fit") : idx(d.etapa);
const FUNIL: { nome: string; desde: number; desc: string }[] = [
  { nome: "Entraram", desde: 0, desc: "Todas as startups que entraram no pipeline no período (começam em Validation Fit)." },
  { nome: "General Analysis", desde: idx("geral"), desc: "Passaram a análise geral (com a Beta Capital)." },
  { nome: "Deep Analysis", desde: idx("aprofundada"), desc: "Análise aprofundada e due diligence." },
  { nome: "Investment Committee", desde: idx("comite"), desc: "Chegaram ao comité de investimento." },
  { nome: "Closing Stage", desde: idx("fecho"), desc: "MoU, acordo de investimento e fecho." },
  { nome: "Investida", desde: idx("investida"), desc: "Entraram no portefólio." },
];

type Tip = { x: number; y: number; t: string; s: string } | null;

/** Review do dealflow: funil, startups por vertical e mapa por país, por ano de entrada. */
export function ReviewView() {
  const { deals, loaded } = useDeals();
  return <ReviewBody deals={deals} loaded={loaded} />;
}

export function ReviewBody({ deals, loaded }: { deals: Deal[]; loaded: boolean }) {
  // Por defeito, o ano atual (aparece sempre na lista, mesmo sem startups)
  const anoAtual = String(new Date().getFullYear());
  const anos = useMemo(() => [...new Set([anoAtual, ...deals.map((d) => (d.entrada || d.criadoEm || "").slice(0, 4)).filter((a) => /^\d{4}$/.test(a))])].sort().reverse(), [deals, anoAtual]);
  const [ano, setAno] = useState<string>(anoAtual);
  const lista = useMemo(() => deals.filter((d) => ano === "all" || (d.entrada || d.criadoEm || "").startsWith(ano)), [deals, ano]);
  const [tip, setTip] = useState<Tip>(null);
  // Startups do elemento em que se clicou (fase do funil, barra ou país)
  const [sel, setSel] = useState<{ titulo: string; lista: Deal[] } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [porQ, setPorQ] = useState<"cadeia" | "categoria">("cadeia");
  const areas = useAreas(), categorias = useCategorias();
  useEffect(() => setSel(null), [ano]);
  const ver = (titulo: string, l: Deal[]) => { setSel({ titulo, lista: l }); setTimeout(() => document.getElementById("rev-sel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 30); };

  if (!loaded) return <div className="loading">A carregar…</div>;
  if (!deals.length) return <p className="hint">Ainda não há startups no pipeline.</p>;

  const total = lista.length;
  const investidas = lista.filter((d) => d.etapa === "investida").length;
  const curso = lista.filter((d) => emCurso(d.etapa)).length;
  const arquivadas = lista.filter((d) => d.etapa === "arquivada").length;
  const fit = lista.filter((d) => chegou(d) >= idx("geral")).length;
  const pct = (n: number) => total ? `${Math.round((n / total) * 100)}%` : "0%";
  const periodo = ano === "all" ? "Desde o início" : `Em ${ano}`;

  return (
    <div className="rev" onMouseLeave={() => setTip(null)}>
      <div className="head">
        <div><h1>Review</h1><p>O dealflow da Sogrape Ventures: quantas startups entraram, até onde chegaram, em que cadeias de valor e de onde vêm. Clica numa fase, numa barra ou num país para ver as startups.</p></div>
      </div>
      <div className="toolbar">
        <label className="fsel on">
          <select value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Período">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="all">Todos os anos</option>
          </select></label>
        <span className="rev-sum">{periodo}, a Sogrape e a Beta Capital analisaram {total} {total === 1 ? "startup" : "startups"}.</span>
      </div>

      <div className="rev-k" key={ano}>
        <div className="rk main"><b><Conta n={total} /></b><span>startups analisadas</span></div>
        <div className="rk"><b><Conta n={fit} /></b><span>passaram à General Analysis</span><em>{pct(fit)}</em></div>
        <div className="rk"><b><Conta n={curso} /></b><span>em curso</span><em>{pct(curso)}</em></div>
        <div className="rk hi"><b><Conta n={investidas} /></b><span>{investidas === 1 ? "investida" : "investidas"}</span><em>{pct(investidas)}</em></div>
        <div className="rk mut"><b><Conta n={arquivadas} /></b><span>arquivadas</span><em>{pct(arquivadas)}</em></div>
      </div>

      <div className="rev-g">
        <section className="rev-c">
          <div className="rev-h"><h2>Funil do dealflow</h2><span>Até que fase chegou cada startup (uma arquivada conta até onde estava).</span></div>
          <Funil lista={lista} setTip={setTip} k={ano} onPick={ver} />
        </section>
        <section className="rev-c">
          <div className="rev-h"><h2>Startups por</h2>
            <label className="fsel on rev-por"><select value={porQ} onChange={(e) => setPorQ(e.target.value as "cadeia" | "categoria")} aria-label="Agrupar por">
              <option value="cadeia">cadeia de valor</option><option value="categoria">categoria</option></select></label>
            <span className="rev-lg"><i style={{ background: COR_EST.investida }} />Investida<i style={{ background: COR_EST.curso }} />Em curso<i style={{ background: COR_EST.radar }} />Radar<i style={{ background: COR_EST.arquivada }} />Arquivada</span></div>
          <Verticais lista={lista} setTip={setTip} k={`${ano}${porQ}`} grupos={(porQ === "cadeia" ? areas : categorias).map((x) => ({ id: x.id, nome: x.nome }))} campo={porQ} onPick={ver} />
        </section>
        <section className="rev-c full">
          <div className="rev-h"><h2>De onde vêm</h2><span>Quanto mais escuro, mais startups.</span></div>
          <Mapa lista={lista} setTip={setTip} onPick={ver} />
        </section>
      </div>
      {sel && (
        <section className="rev-c full rev-sel" id="rev-sel" aria-label={sel.titulo}>
          <div className="rev-h"><h2>{sel.titulo}</h2><span>{sel.lista.length} {sel.lista.length === 1 ? "startup" : "startups"}</span>
            <button className="btn icon" aria-label="Fechar a lista" onClick={() => setSel(null)}><Icon name="x" /></button></div>
          {sel.lista.length ? <ul className="rev-ls">{[...sel.lista].sort((a, b) => a.nome.localeCompare(b.nome)).map((d) => (
            <li key={d.id}><button onClick={() => setOpenId(d.id)}>
              <b>{d.nome}</b><span className={`tg e-${d.etapa}`}>{ETAPAS.find((e) => e.id === d.etapa)?.nome}</span>
              <span className="mut">{[bandeiraDe(d.pais), d.pais].filter(Boolean).join(" ")}</span>
              <span className="mut">{areas.find((a) => a.id === d.cadeia)?.nome || ""}</span></button></li>
          ))}</ul> : <p className="hint">Nenhuma startup.</p>}
        </section>
      )}
      {openId && deals.find((d) => d.id === openId) && <DealDrawer d={deals.find((d) => d.id === openId)!} list={sel?.lista || []} origens={[]} pessoas={[]}
        onClose={() => setOpenId(null)} onNav={setOpenId} notify={(m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); }} />}
      {msg && <div className="toast" role="status"><span>{msg}</span></div>}
      {tip && <div className="rev-tip" role="status" style={{ left: tip.x, top: tip.y }}><b>{tip.t}</b><span>{tip.s}</span></div>}
    </div>
  );
}

/** Número que conta até ao valor ao abrir (parado para quem reduz o movimento). */
function Conta({ n }: { n: number }) {
  const [v, setV] = useState(n);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || n < 2) { setV(n); return; }
    let raf = 0; const t0 = performance.now(), dur = 900;
    const step = (t: number) => { const p = Math.min(1, (t - t0) / dur); setV(Math.round(n * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <>{v}</>;
}

/** Estados para o gráfico das verticais (o cinzento das arquivadas é de propósito: recua). */
const COR_EST = { investida: "#7F3A22", curso: "#D8906D", radar: "#EBC3AD", arquivada: "#E6E6E6" };
const estado = (d: Deal) => d.etapa === "investida" ? "investida" : d.etapa === "arquivada" ? "arquivada" : d.etapa === "radar" ? "radar" : "curso";

const pos = (e: React.MouseEvent) => ({ x: e.clientX + 14, y: e.clientY + 14 });

/** Funil na vertical: uma faixa que estreita de cima para baixo, com um patamar em cada fase. */
function Funil({ lista, setTip, k, onPick }: { lista: Deal[]; setTip: (t: Tip) => void; k: string; onPick: (t: string, l: Deal[]) => void }) {
  const n = FUNIL.map((f) => lista.filter((d) => chegou(d) >= f.desde).length);
  const rows = FUNIL.length, W = 560, step = 66, top = 6, H = top + rows * step + 6;
  const Wmax = 250, cx = 168 + Wmax / 2 + 10, plat = step * 0.46;
  const w = n.map((v) => (n[0] ? Math.max(v ? 10 : 2, (v / n[0]) * Wmax) : 2));
  const y0 = (i: number) => top + i * step + (step - plat) / 2, y1 = (i: number) => y0(i) + plat, yc = (i: number) => top + i * step + step / 2;
  // Lado esquerdo de cima para baixo, base, lado direito de baixo para cima: a forma fecha sem ponta
  let d = `M ${cx - w[0] / 2} ${y0(0)}`;
  for (let i = 0; i < rows; i++) {
    d += ` L ${cx - w[i] / 2} ${y1(i)}`;
    if (i < rows - 1) { const m = (y1(i) + y0(i + 1)) / 2; d += ` C ${cx - w[i] / 2} ${m}, ${cx - w[i + 1] / 2} ${m}, ${cx - w[i + 1] / 2} ${y0(i + 1)}`; }
  }
  d += ` L ${cx + w[rows - 1] / 2} ${y1(rows - 1)}`;
  for (let i = rows - 1; i >= 0; i--) {
    d += ` L ${cx + w[i] / 2} ${y0(i)}`;
    if (i > 0) { const m = (y1(i - 1) + y0(i)) / 2; d += ` C ${cx + w[i] / 2} ${m}, ${cx + w[i - 1] / 2} ${m}, ${cx + w[i - 1] / 2} ${y1(i - 1)}`; }
  }
  d += " Z";
  return (
    <div className="rev-fl">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Funil: ${FUNIL.map((f, i) => `${f.nome} ${n[i]}`).join(", ")}`} key={k}>
        <defs>
          <linearGradient id="rfg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8B3D26" /><stop offset="0.45" stopColor="#B15533" /><stop offset="1" stopColor="#E3AB8F" /></linearGradient>
          <clipPath id="rfc"><rect className="rev-grow" x="0" y="0" width={W} height={H} /></clipPath>
        </defs>
        {FUNIL.map((_, i) => i > 0 && <line key={i} x1={0} x2={W} y1={top + i * step} y2={top + i * step} className="rev-gl" />)}
        <path d={d} fill="url(#rfg)" clipPath="url(#rfc)" />
        {FUNIL.map((f, i) => {
          const conv = i > 0 && n[i - 1] ? Math.round((n[i] / n[i - 1]) * 100) : null, perdeu = i > 0 ? n[i - 1] - n[i] : 0, yt = top + i * step;
          return (
            <g key={f.nome} className="rev-st" role="button" tabIndex={0} aria-label={`Ver as ${n[i]} startups de ${f.nome}`}
              onClick={() => onPick(f.nome, lista.filter((d) => chegou(d) >= f.desde))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(f.nome, lista.filter((d) => chegou(d) >= f.desde)); } }} onMouseMove={(e) => setTip({ ...pos(e), t: `${f.nome}: ${n[i]}`, s: `${f.desc}${conv !== null ? ` Passaram ${conv}% das startups da fase anterior; ${perdeu} ficaram pelo caminho.` : ""}` })} onMouseLeave={() => setTip(null)}>
              <rect x={0} y={yt} width={W} height={step} fill="transparent" />
              <text x={0} y={yc(i) - 3} className="rev-fn">{n[i]}</text>
              <text x={0} y={yc(i) + 17} className="rev-fs">{f.nome}</text>
              {conv !== null && <g transform={`translate(${cx}, ${yt})`}>
                <rect x={-24} y={-12} width={48} height={24} rx={12} className="rev-pill" />
                <text x={0} y={4.5} textAnchor="middle" className="rev-pt">{conv}%</text></g>}
              {perdeu > 0 && <text x={W - 4} y={yt + 4.5} textAnchor="end" className="rev-lost">-{perdeu}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Barras na vertical: uma coluna por cadeia de valor (ou categoria), empilhada por estado (investida em baixo, arquivada em cima). */
function Verticais({ lista, setTip, k, grupos, campo, onPick }: { lista: Deal[]; setTip: (t: Tip) => void; k: string; grupos: { id: string; nome: string }[]; campo: "cadeia" | "categoria"; onPick: (t: string, l: Deal[]) => void }) {
  const rows = [...grupos.map((g) => ({ nome: g.nome, l: lista.filter((d) => d[campo] === g.id) })), { nome: campo === "cadeia" ? "Sem cadeia" : "Sem categoria", l: lista.filter((d) => !grupos.some((g) => g.id === d[campo])) }]
    .filter((r, i, a) => i < a.length - 1 || r.l.length > 0);
  const total = Math.max(1, lista.length), max = Math.max(1, ...rows.map((r) => r.l.length));
  return (
    <ol className="rev-vb" key={k}>
      {rows.map((r, ri) => {
        const c = { investida: 0, curso: 0, radar: 0, arquivada: 0 }; r.l.forEach((d) => c[estado(d)]++);
        return (
          <li key={r.nome} role="button" tabIndex={0} aria-label={`Ver as ${r.l.length} startups de ${r.nome}`} onClick={() => onPick(r.nome, r.l)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(r.nome, r.l); } }}
            onMouseMove={(e) => setTip({ ...pos(e), t: `${r.nome}: ${r.l.length}`, s: `${Math.round((r.l.length / total) * 100)}% do total. ${c.investida} ${c.investida === 1 ? "investida" : "investidas"}, ${c.curso} em curso, ${c.radar} no radar, ${c.arquivada} ${c.arquivada === 1 ? "arquivada" : "arquivadas"}. Clica para ver quais.` })} onMouseLeave={() => setTip(null)}>
            <span className="vbn">{r.l.length}</span>
            <span className="vbt">
              <span className="vbb" style={{ height: `${(r.l.length / max) * 100}%`, ["--k" as string]: ri }}>
                {(["arquivada", "radar", "curso", "investida"] as const).map((e) => c[e] > 0 && <i key={e} style={{ flexGrow: c[e], background: COR_EST[e] }} />)}
              </span>
            </span>
            <span className="vbl">{r.nome}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Desvio do número para fora do país (países pequenos ou colados a vizinhos). */
const FORA: Record<string, [number, number]> = { "620": [-9, 2], "056": [-8, -3], "528": [-6, -6], "442": [-6, 6], "756": [-2, 9], "208": [0, -9], "372": [-8, 0], "040": [6, 6], "705": [4, 8], "196": [6, 0], "376": [-6, 4] };

type World = { w: number; h: number; p: [string, string, string, [number, number] | null][] };

function Mapa({ lista, setTip, onPick }: { lista: Deal[]; setTip: (t: Tip) => void; onPick: (t: string, l: Deal[]) => void }) {
  const [world, setWorld] = useState<World | null>(null);
  useEffect(() => { import("@/lib/world.json").then((m) => setWorld((m.default || m) as unknown as World)); }, []);
  const { porId, nomes, semPais, desconhecidos, ranking } = useMemo(() => {
    const porId = new Map<string, number>(), nomes = new Map<string, string>(), cont = new Map<string, number>(), ids = new Map<string, string>();
    let semPais = 0; const desconhecidos = new Map<string, number>();
    for (const d of lista) {
      if (!d.pais?.trim()) { semPais++; continue; }
      const r = lerPais(d.pais);
      if (!r) { desconhecidos.set(d.pais.trim(), (desconhecidos.get(d.pais.trim()) || 0) + 1); continue; }
      cont.set(r.nome, (cont.get(r.nome) || 0) + 1); if (r.id) ids.set(r.nome, r.id);
      if (r.id) { porId.set(r.id, (porId.get(r.id) || 0) + 1); nomes.set(r.id, r.nome); }
    }
    const ranking = [...cont.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p, n]) => [p, n, ids.get(p) || ""] as [string, number, string]);
    return { porId, nomes, semPais, desconhecidos: [...desconhecidos.entries()], ranking };
  }, [lista]);
  const max = Math.max(1, ...porId.values());
  const doPais = (nome: string) => lista.filter((d) => lerPais(d.pais)?.nome === nome);
  // Escala logarítmica em 5 tons: com Portugal a 31 e muitos países a 1 ou 2, uma escala linear deixava quase tudo igual
  const tom = (n: number) => !n ? ZERO : AZUL[Math.min(AZUL.length - 1, Math.floor((Math.log(n) / Math.log(max + 1)) * AZUL.length))];
  const passos = AZUL.map((_, i) => Math.max(1, Math.ceil(Math.pow(max + 1, i / AZUL.length))));

  return (
    <div className="rev-m">
      <div className="rev-map">
        {world ? (
          <svg viewBox={`0 0 ${world.w} ${world.h}`} role="img" aria-label="Mapa com o número de startups por país">
            {world.p.map(([id, nome, d]) => { const n = porId.get(id) || 0; return (
              <path key={id} d={d} fill={tom(n)} stroke="#fff" strokeWidth={0.6} className={n ? "on" : ""}
                onClick={() => n && onPick(nomes.get(id) || nome, doPais(nomes.get(id) || nome))}
                onMouseMove={(e) => setTip({ ...pos(e), t: `${bandeira(id)} ${nomes.get(id) || nome}`.trim(), s: n ? `${n} ${n === 1 ? "startup" : "startups"}. Clica para ver quais.` : "Sem startups" })} onMouseLeave={() => setTip(null)} />); })}
            {world.p.map(([id, , , c]) => { const n = porId.get(id) || 0; if (!n || !c) return null;
              // Países pequenos colados a outros: o número fica fora, ao lado (Portugal à esquerda de Espanha)
              const fora = FORA[id];
              return fora ? <text key={`t${id}`} x={c[0] + fora[0]} y={c[1] + fora[1] + 4} textAnchor={fora[0] < 0 ? "end" : "start"} className="ml" style={{ fill: "#171717" }}>{n}</text>
                : <text key={`t${id}`} x={c[0]} y={c[1] + 4} textAnchor="middle" className="ml" style={{ fill: tom(n) === AZUL[3] || tom(n) === AZUL[4] ? "#fff" : "#171717" }}>{n}</text>; })}
          </svg>
        ) : <div className="loading">A carregar o mapa…</div>}
        <div className="rev-leg" aria-hidden="true"><span>Startups</span>{AZUL.map((c, i) => <i key={c} style={{ background: c }} title={`${passos[i]}+`} />)}<span>{max}</span></div>
      </div>
      <div className="rev-tab">
        <table><thead><tr><th>País</th><th className="n">Startups</th></tr></thead>
          <tbody>{ranking.map(([p, n, id]) => <tr key={p} className="rev-pr" tabIndex={0} onClick={() => onPick(p, doPais(p))} onKeyDown={(e) => { if (e.key === "Enter") onPick(p, doPais(p)); }}>
            <td><span className="tb"><i style={{ width: `${(n / Math.max(1, ranking[0]?.[1] || 1)) * 100}%` }} /></span><span className="flag" aria-hidden="true">{bandeira(id)}</span>{p}</td><td className="n">{n}</td></tr>)}</tbody></table>
        {(semPais > 0 || desconhecidos.length > 0) && <p className="hint">
          {semPais > 0 && <>{semPais} sem país na ficha. </>}
          {desconhecidos.length > 0 && <>País não reconhecido: {desconhecidos.map(([p, n]) => `${p} (${n})`).join(", ")}. Corrige o nome na ficha para aparecer no mapa.</>}</p>}
      </div>
    </div>
  );
}
