"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { Area, Category, CRITERIOS, Deal, ETAPAS, FASES, Run, Sector, Signal, Startup } from "@/lib/types";
import { fdCurto, fdLongo } from "@/lib/util";
import { useSession } from "../AuthGate";
import { prazoEstado } from "../pipeline/PipelineBoard";

export type DashGo = { view: "news"; st: "pending" | "approved" | "rejected" | "radar" } | { view: "startups"; page: "pending" | "approved" | "rejected" | "radar" | "pipeline" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const semana = (d: Date) => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t; };

/* ---------- Peças ---------- */

function Tile({ n, label, sub, tone, onClick }: { n: number | string; label: string; sub?: string; tone?: "warn" | "ok" | "no"; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return <C className={`dtile${tone ? ` t-${tone}` : ""}${onClick ? " click" : ""}`} onClick={onClick}>
    <b>{n}</b><span>{label}</span>{sub && <em>{sub}</em>}{onClick && <Icon name="arrow-up-right" className="go" />}</C>;
}

/** Barras horizontais: uma linha por item, valor à direita; cor da entidade quando existe. */
function Bars({ rows, total, unit = "", empty = "Sem dados" }: { rows: { k: string; n: number; c?: string; sub?: string }[]; total?: number; unit?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length || rows.every((r) => !r.n)) return <p className="dempty">{empty}</p>;
  return (
    <ul className="dbars">{rows.map((r) => (
      <li key={r.k} title={`${r.k}: ${r.n}${unit}${total ? ` (${pct(r.n, total)}%)` : ""}`}>
        <span className="l">{r.c && <i style={{ background: r.c }} />}{r.k}{r.sub && <em>{r.sub}</em>}</span>
        <span className="t"><span className="f" style={{ width: `${(r.n / max) * 100}%`, ...(r.c ? { background: r.c } : {}) }} /></span>
        <span className="v">{r.n}{unit}{total ? <small>{pct(r.n, total)}%</small> : null}</span>
      </li>
    ))}</ul>
  );
}

/** Duas partes de um todo numa barra (ex.: Europa e fora da Europa). */
function Split({ a, b, la, lb, ca = "var(--ink)", cb = "var(--surface-3)" }: { a: number; b: number; la: string; lb: string; ca?: string; cb?: string }) {
  const t = a + b;
  if (!t) return <p className="dempty">Sem dados</p>;
  return (<div className="dsplit">
    <div className="bar" role="img" aria-label={`${la}: ${a}; ${lb}: ${b}`}>
      {a > 0 && <span style={{ width: `${pct(a, t)}%`, background: ca }} title={`${la}: ${a} (${pct(a, t)}%)`} />}
      {b > 0 && <span style={{ width: `${pct(b, t)}%`, background: cb }} title={`${lb}: ${b} (${pct(b, t)}%)`} />}
    </div>
    <div className="lg"><span><i style={{ background: ca }} />{la} <b>{a}</b> <small>{pct(a, t)}%</small></span><span><i style={{ background: cb }} />{lb} <b>{b}</b> <small>{pct(b, t)}%</small></span></div>
  </div>);
}

/** Entradas e aprovadas por semana (12 semanas), barras lado a lado com dica ao passar o rato. */
function Weekly({ signals }: { signals: Signal[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const weeks = useMemo(() => {
    const start = semana(new Date()); start.setDate(start.getDate() - 7 * 11);
    const ws = Array.from({ length: 12 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + 7 * i); return { d, ent: 0, apr: 0 }; });
    const idx = (iso?: string) => { if (!iso) return -1; const t = semana(new Date(iso)).getTime(); return ws.findIndex((w) => w.d.getTime() === t); };
    signals.forEach((s) => { const i = idx(s.criadoEm); if (i >= 0) ws[i].ent++; const j = s.status === "approved" ? idx(s.aprovadoEm || s.atualizadoEm) : -1; if (j >= 0) ws[j].apr++; });
    return ws;
  }, [signals]);
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.ent, w.apr)));
  const H = 140, W = 100 / weeks.length;
  const h = hover !== null ? weeks[hover] : null;
  return (<div className="dweek">
    <div className="dleg"><span><i className="s-ent" />Entraram na triagem</span><span><i className="s-apr" />Aprovadas</span></div>
    <div className="plot" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {[0.5, 1].map((g) => <line key={g} x1={0} x2={100} y1={H - g * (H - 6)} y2={H - g * (H - 6)} className="grid" vectorEffect="non-scaling-stroke" />)}
        {weeks.map((w, i) => {
          const x = i * W, bw = W * 0.32, he = (w.ent / max) * (H - 6), ha = (w.apr / max) * (H - 6);
          return <g key={i} className={hover === i ? "on" : ""}>
            <rect x={x} y={0} width={W} height={H} className="hit" onMouseEnter={() => setHover(i)} />
            <rect x={x + W * 0.16} y={H - he} width={bw} height={he} rx={0.6} className="s-ent" />
            <rect x={x + W * 0.52} y={H - ha} width={bw} height={ha} rx={0.6} className="s-apr" />
          </g>;
        })}
      </svg>
      {h && <div className="tip" style={{ left: `${Math.min(80, (hover! + 0.5) * W)}%` }}><b>Semana de {fdCurto(h.d.toISOString())}</b><span>{h.ent} entraram</span><span>{h.apr} aprovadas</span></div>}
    </div>
    <table className="sr"><caption>Notícias por semana</caption><thead><tr><th>Semana</th><th>Entraram</th><th>Aprovadas</th></tr></thead>
      <tbody>{weeks.map((w) => <tr key={w.d.toISOString()}><td>{fdCurto(w.d.toISOString())}</td><td>{w.ent}</td><td>{w.apr}</td></tr>)}</tbody></table>
    <div className="xax"><span>{fdCurto(weeks[0].d.toISOString())}</span><span>{fdCurto(weeks[6].d.toISOString())}</span><span>Esta semana</span></div>
  </div>);
}

function Card({ title, sub, children, wide }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  return <section className={`dcard2${wide ? " wide" : ""}`}><header><h3>{title}</h3>{sub && <p>{sub}</p>}</header>{children}</section>;
}

/* ---------- Página ---------- */

/** Dashboard: o que precisa de atenção, startups, notícias e (admins) pipeline. */
export function Dashboard({ signals, areas, cats, go }: { signals: Signal[]; areas: Area[]; cats: Category[]; go: (g: DashGo) => void }) {
  const { isAdmin, canPipeline } = useSession();
  const [startups, setStartups] = useState<Startup[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    const u = [
      onSnapshot(collection(db, "startups"), (s) => setStartups(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Startup)), () => {}),
      onSnapshot(query(collection(db, "sectors"), orderBy("ordem")), (s) => setSectors(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Sector)), () => {}),
    ];
    if (canPipeline) u.push(onSnapshot(collection(db, "deals"), (s) => setDeals(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Deal)), () => {}));
    if (isAdmin) u.push(onSnapshot(query(collection(db, "runs"), orderBy("inicio", "desc"), limit(20)), (s) => setRuns(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Run)), () => {}));
    return () => u.forEach((f) => f());
  }, [canPipeline, isAdmin]);
  return <DashboardView {...{ signals, areas, cats, go, startups, sectors, deals, runs, isAdmin, canPipeline }} />;
}

/** A página em si, só com os dados (sem leituras à base de dados). */
export function DashboardView({ signals, areas, cats, go, startups, sectors, deals, runs, isAdmin, canPipeline }: {
  signals: Signal[]; areas: Area[]; cats: Category[]; go: (g: DashGo) => void;
  startups: Startup[]; sectors: Sector[]; deals: Deal[]; runs: Run[]; isAdmin: boolean; canPipeline: boolean;
}) {
  const nPend = signals.filter((s) => s.status === "pending").length;
  const sPend = startups.filter((s) => s.status === "pending").length;
  const ativas = deals.filter((d) => d.etapa !== "arquivada");
  const atrasadas = ativas.filter((d) => prazoEstado(d) === "atrasado");
  const minhas = ativas.filter((d) => d.vez === "sogrape");
  const lastDaily = runs.find((r) => r.tipo !== "startups"), lastWeekly = runs.find((r) => r.tipo === "startups");
  const runTone = (r?: Run) => !r ? undefined : r.estado === "erro" ? "no" : r.estado === "ok" ? "ok" : undefined;
  const runSub = (r?: Run) => !r ? "Sem registo" : `${r.estado === "erro" ? "Falhou" : r.estado === "ok" ? "Correu bem" : "A correr"} · ${fdLongo(r.inicio)}`;

  /* Startups */
  const st = useMemo(() => {
    const vivas = startups.filter((s) => s.status !== "rejected");
    const aprov = startups.filter((s) => s.status === "approved");
    const noPipe = new Set([...startups.filter((s) => s.dealId).map((s) => s.id), ...deals.map((d) => d.startupId).filter(Boolean) as string[]]);
    const comAn = startups.filter((s) => s.analiseResumo);
    const falhas = CRITERIOS.map((c) => ({ k: c.nome, neg: comAn.filter((s) => s.analiseResumo?.negativos?.includes(c.id)).length, inc: comAn.filter((s) => s.analiseResumo?.incertos?.includes(c.id)).length }))
      .filter((x) => x.neg + x.inc > 0).sort((a, b) => b.neg - a.neg || b.inc - a.inc).slice(0, 6);
    return {
      total: startups.length, aprov: aprov.length, noPipe: noPipe.size, investidas: deals.filter((d) => d.etapa === "investida").length,
      setores: sectors.map((x) => ({ k: x.nome, n: vivas.filter((s) => s.setor === x.id).length, c: x.cor })),
      fases: [...FASES].reverse().map((f) => ({ k: f.nome, n: vivas.filter((s) => s.fase === f.id).length })),
      inv: comAn.filter((s) => s.analiseResumo?.decisao === "investir").length, nao: comAn.filter((s) => s.analiseResumo?.decisao === "nao-investir").length,
      semAnalise: vivas.filter((s) => !s.analiseResumo).length, falhas, comFalhas: comAn.filter((s) => s.analiseResumo?.negativos).length,
    };
  }, [startups, sectors, deals]);

  /* Notícias */
  const nw = useMemo(() => {
    const aprov = signals.filter((s) => s.status === "approved");
    return {
      areas: areas.map((a) => ({ k: a.nome, n: aprov.filter((s) => s.area === a.id).length, c: a.cor })),
      cats: cats.map((c) => ({ k: c.nome, n: aprov.filter((s) => s.categoria === c.id).length })),
    };
  }, [signals, areas, cats]);

  /* Pipeline */
  const pp = useMemo(() => {
    const ord = Object.fromEntries(ETAPAS.map((e, i) => [e.id, i]));
    const fit = ord["fit"];
    const passou = (d: Deal) => (d.etapa === "arquivada" ? ord[d.arquivo?.etapaAnterior || "contacto"] : ord[d.etapa]) >= fit;
    const porOrigem = new Map<string, { n: number; a: number }>();
    deals.forEach((d) => { const k = d.origem?.nome || "Sem origem"; const v = porOrigem.get(k) || { n: 0, a: 0 }; v.n++; if (passou(d)) v.a++; porOrigem.set(k, v); });
    const hoje = Date.parse(new Date().toISOString().slice(0, 10));
    return {
      prazos: ativas.filter((d) => d.prazo && Date.parse(d.prazo) - hoje <= 7 * 864e5).sort((a, b) => (a.prazo || "").localeCompare(b.prazo || "")).slice(0, 8),
      origens: [...porOrigem.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.n - a.n).slice(0, 6),
    };
  }, [deals, ativas]);

  return (<div className="dash">
    <div className="head"><div><h1>Dashboard</h1><p>O que precisa de ti agora e como estão a correr as notícias, as startups{canPipeline ? " e o pipeline" : ""}.</p></div></div>

    {/* 1. Precisa de atenção */}
    <h2 className="dsec">Precisa de atenção</h2>
    <div className="dtiles">
      <Tile n={nPend} label="Notícias por decidir" tone={nPend ? "warn" : undefined} onClick={() => go({ view: "news", st: "pending" })} />
      <Tile n={sPend} label="Startups por decidir" tone={sPend ? "warn" : undefined} onClick={() => go({ view: "startups", page: "pending" })} />
      {canPipeline && <Tile n={atrasadas.length} label="Pipeline com prazo ultrapassado" tone={atrasadas.length ? "no" : undefined} onClick={() => go({ view: "startups", page: "pipeline" })} />}
      {canPipeline && <Tile n={minhas.length} label="No pipeline à espera da Sogrape" onClick={() => go({ view: "startups", page: "pipeline" })} />}
      {isAdmin && <Tile n={lastDaily ? (lastDaily.estado === "erro" ? "Erro" : "OK") : "-"} label="Recolha diária de notícias" sub={runSub(lastDaily)} tone={runTone(lastDaily)} />}
      {isAdmin && <Tile n={lastWeekly ? (lastWeekly.estado === "erro" ? "Erro" : "OK") : "-"} label="Recolha semanal de startups" sub={runSub(lastWeekly)} tone={runTone(lastWeekly)} />}
    </div>

    {/* 2. Startups */}
    <h2 className="dsec">Startups</h2>
    <ul className="dfunnel" aria-label="Funil das startups">
      {[{ k: "Encontradas", n: st.total, p: "startups" as const }, { k: "Aprovadas", n: st.aprov, p: "approved" as const }, { k: "No pipeline", n: st.noPipe, p: "pipeline" as const },
        ...(canPipeline ? [{ k: "Investidas", n: st.investidas, p: "pipeline" as const }] : [])].map((x, i, arr) => (
        <li key={x.k}><button className="fstep" onClick={() => go({ view: "startups", page: x.p === "startups" ? "pending" : x.p === "pipeline" && !canPipeline ? "approved" : x.p })}>
          <span className="fb" style={{ width: `${Math.max(8, (x.n / Math.max(1, arr[0].n)) * 100)}%` }} />
          <b>{x.n}</b><span>{x.k}</span>{i > 0 && <em>{pct(x.n, arr[i - 1].n)}% da fase anterior</em>}
        </button></li>
      ))}
    </ul>
    <div className="dgrid">
      <Card title="Por setor" sub="Startups em triagem e aprovadas"><Bars rows={st.setores} total={st.setores.reduce((a, r) => a + r.n, 0)} /></Card>
      <Card title="Por fase de investimento"><Bars rows={st.fases} total={st.fases.reduce((a, r) => a + r.n, 0)} /></Card>
      <Card wide title="Análises de investimento" sub={st.semAnalise ? `${st.semAnalise} startups ainda sem análise` : "Todas as startups têm análise"}>
        <Split a={st.inv} b={st.nao} la="Investir" lb="Não investir" ca="var(--pos,#1A7F37)" cb="var(--neg,#C42B31)" />
        <h4 className="dsub">Critérios que mais falham</h4>
        {st.falhas.length ? (<>
          <ul className="dbars two">{st.falhas.map((f) => { const m = Math.max(1, ...st.falhas.map((x) => x.neg + x.inc)); return (
            <li key={f.k} title={`${f.k}: ${f.neg} negativos, ${f.inc} incertos`}><span className="l">{f.k}</span>
              <span className="t"><span className="f neg" style={{ width: `${(f.neg / m) * 100}%` }} /><span className="f inc" style={{ width: `${(f.inc / m) * 100}%` }} /></span>
              <span className="v">{f.neg}<small>+{f.inc}</small></span></li>); })}</ul>
          <div className="dleg sm"><span><i style={{ background: "var(--neg,#C42B31)" }} />Negativo</span><span><i style={{ background: "#E8B04A" }} />Incerto</span></div>
        </>) : <p className="dempty">Aparece à medida que forem feitas análises novas.</p>}
      </Card>
    </div>

    {/* 3. Notícias */}
    <h2 className="dsec">Notícias</h2>
    <div className="dgrid">
      <Card title="Ritmo das últimas 12 semanas" wide><Weekly signals={signals} /></Card>
      <Card title="No radar por área"><Bars rows={nw.areas} total={nw.areas.reduce((a, r) => a + r.n, 0)} /></Card>
      <Card title="No radar por categoria"><Bars rows={nw.cats} total={nw.cats.reduce((a, r) => a + r.n, 0)} /></Card>
    </div>

    {/* 4. Pipeline */}
    {canPipeline && (<>
      <h2 className="dsec">Pipeline</h2>
      <div className="dgrid">
        <Card wide title="Prazos até 7 dias" sub="Incluindo os que já passaram">
          {pp.prazos.length ? <ul className="dlist">{pp.prazos.map((d) => { const pz = prazoEstado(d); return (
            <li key={d.id}><span className={`pz ${pz === "atrasado" ? "late" : pz === "breve" ? "soon" : ""}`}>{fdCurto(d.prazo!)}</span><b>{d.nome}</b><span>{d.proximaAcao || "Sem próximo passo"}</span></li>); })}</ul>
            : <p className="dempty">Nenhum prazo nos próximos 7 dias.</p>}
          <button className="txtbtn" onClick={() => go({ view: "startups", page: "pipeline" })}>Abrir o pipeline<Icon name="arrow-up-right" /></button>
        </Card>
        <Card title="Origens que avançam" sub="Quantas entraram por cada origem e quantas chegaram à validação de fit" wide>
          {pp.origens.length ? <table className="dtbl"><thead><tr><th>Origem</th><th className="n">Entraram</th><th className="n">Avançaram</th><th>Taxa</th></tr></thead>
            <tbody>{pp.origens.map((o) => <tr key={o.k}><td>{o.k}</td><td className="n">{o.n}</td><td className="n">{o.a}</td>
              <td><span className="rate"><span className="t"><span className="f" style={{ width: `${pct(o.a, o.n)}%` }} /></span><b>{pct(o.a, o.n)}%</b></span></td></tr>)}</tbody></table>
            : <p className="dempty">O pipeline ainda está vazio.</p>}
        </Card>
      </div>
    </>)}
  </div>);
}
