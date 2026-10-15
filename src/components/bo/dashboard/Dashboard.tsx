"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { nomeEtapa } from "@/lib/deal-actions";
import { Area, Deal, Run, Signal, Startup, VEZES } from "@/lib/types";
import { fdCurto, fdLongo, hojeLocal } from "@/lib/util";
import { useSession } from "../AuthGate";
import { estadoPrazo } from "../pipeline/PipelineBoard";
import { itensComPrazo } from "../pipeline/PipelineCalendar";

export type DashGo = { view: "news"; st: "pending" | "approved" | "rejected" | "radar" } | { view: "startups"; page: "pending" | "approved" | "rejected" | "radar" | "pipeline" };

const addDays = (s: string, n: number) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const saudacao = () => { const h = new Date().getHours(); return h < 13 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite"; };

/** Dashboard: o que precisa de decisão agora, os próximos passos e um resumo curto. */
export function Dashboard({ signals, areas, go }: { signals: Signal[]; areas: Area[]; go: (g: DashGo) => void }) {
  const { isAdmin, canPipeline, profile, email } = useSession();
  const [startups, setStartups] = useState<Startup[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    const u = [onSnapshot(collection(db, "startups"), (s) => setStartups(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Startup)), () => {})];
    if (canPipeline) u.push(onSnapshot(collection(db, "deals"), (s) => setDeals(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Deal)), () => {}));
    if (isAdmin) u.push(onSnapshot(query(collection(db, "runs"), orderBy("inicio", "desc"), limit(20)), (s) => setRuns(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Run)), () => {}));
    return () => u.forEach((f) => f());
  }, [canPipeline, isAdmin]);
  const nome = (profile.nome || email.split("@")[0].split(".")[0]).split(" ")[0];
  return <DashboardView {...{ signals, areas, go, startups, deals, runs, isAdmin, canPipeline, nome }} />;
}

/** A página em si, só com os dados (sem leituras à base de dados). */
export function DashboardView({ signals, areas, go, startups, deals, runs, isAdmin, canPipeline, nome }: {
  signals: Signal[]; areas: Area[]; go: (g: DashGo) => void;
  startups: Startup[]; deals: Deal[]; runs: Run[]; isAdmin: boolean; canPipeline: boolean; nome: string;
}) {
  const hoje = hojeLocal();
  const nPend = signals.filter((s) => s.status === "pending").length;
  const sPend = startups.filter((s) => s.status === "pending").length;
  const ativas = deals.filter((d) => d.etapa !== "arquivada");
  const semana = useMemo(() => itensComPrazo(ativas).filter((x) => x.p.prazo! <= addDays(hoje, 7)), [ativas, hoje]);
  const atrasadas = semana.filter((x) => estadoPrazo(x.p.prazo) === "atrasado").length;
  const recentes = useMemo(() => signals.filter((s) => s.status === "approved").sort((a, b) => (b.aprovadoEm || b.criadoEm).localeCompare(a.aprovadoEm || a.criadoEm)).slice(0, 5), [signals]);
  const lastDaily = runs.find((r) => r.tipo !== "startups"), lastWeekly = runs.find((r) => r.tipo === "startups");
  const tudoFeito = !nPend && !sPend && !atrasadas;

  const Run1 = ({ r, label }: { r?: Run; label: string }) => (
    <li className={r?.estado === "erro" ? "no" : ""}><span className="k">{label}</span>
      <span>{!r ? "Sem registo" : r.estado === "erro" ? `Falhou a ${fdLongo(r.inicio)}` : r.estado === "ok" ? `Correu bem a ${fdLongo(r.inicio)}` : "A correr"}</span></li>
  );

  return (<div className="dash2">
    <header className="d2-h">
      <h1>{saudacao()}, <span className="cap">{nome}</span></h1>
      <p>{tudoFeito ? "Está tudo em dia. Não há nada à espera de decisão." : "Isto é o que está à tua espera."}</p>
    </header>

    <div className="d2-act">
      <button className={`d2-a${nPend ? " on" : ""}`} onClick={() => go({ view: "news", st: "pending" })}>
        <b>{nPend}</b><span>{nPend === 1 ? "notícia por decidir" : "notícias por decidir"}</span><em>Abrir a triagem<Icon name="arrow-up-right" /></em></button>
      <button className={`d2-a${sPend ? " on" : ""}`} onClick={() => go({ view: "startups", page: "pending" })}>
        <b>{sPend}</b><span>{sPend === 1 ? "startup por decidir" : "startups por decidir"}</span><em>Abrir a triagem<Icon name="arrow-up-right" /></em></button>
      {canPipeline && <button className={`d2-a${atrasadas ? " late" : ""}`} onClick={() => go({ view: "startups", page: "pipeline" })}>
        <b>{semana.length}</b><span>{semana.length === 1 ? "passo com prazo esta semana" : "passos com prazo esta semana"}</span>
        <em>{atrasadas ? `${atrasadas} ${atrasadas === 1 ? "atrasado" : "atrasados"}` : "Abrir o pipeline"}<Icon name="arrow-up-right" /></em></button>}
    </div>

    <div className="d2-cols">
      {canPipeline ? (
        <section className="d2-p">
          <div className="d2-ph"><h2>Próximos passos</h2><button className="txtbtn" onClick={() => go({ view: "startups", page: "pipeline" })}>Ver o pipeline<Icon name="arrow-up-right" /></button></div>
          {semana.length ? <ul className="d2-list">{semana.slice(0, 8).map(({ d, p }) => {
            const pz = estadoPrazo(p.prazo), vez = VEZES.find((v) => v.id === p.vez);
            return <li key={`${d.id}-${p.id}`}><span className={`pz ${pz === "atrasado" ? "late" : pz === "breve" ? "soon" : ""}`}>{fdCurto(p.prazo!)}</span>
              <div><b>{d.nome}</b><span>{p.texto || "Sem descrição"}</span></div>
              <span className="d2-m">{vez && <span className={`vez v-${vez.id}`}>{vez.curto}</span>}<em>{nomeEtapa(d.etapa)}</em></span></li>;
          })}</ul> : <div className="d2-empty"><Icon name="calendar-blank" /><b>Nada com prazo nos próximos 7 dias</b><span>Quando uma startup do pipeline tiver um próximo passo com prazo, aparece aqui.</span></div>}
        </section>
      ) : (
        <section className="d2-p">
          <div className="d2-ph"><h2>Últimas no radar</h2><button className="txtbtn" onClick={() => go({ view: "news", st: "radar" })}>Ver o radar<Icon name="arrow-up-right" /></button></div>
          {recentes.length ? <ul className="d2-list">{recentes.map((s) => {
            const a = areas.find((x) => x.id === s.area);
            return <li key={s.id}><span className="d2-dot" style={{ background: a?.cor }} aria-hidden="true" /><div><b>{s.titulo}</b><span>{a?.nome}</span></div></li>;
          })}</ul> : <div className="d2-empty"><Icon name="globe" /><b>Ainda não há notícias aprovadas</b></div>}
        </section>
      )}

      <aside className="d2-s">
        <h2>Em resumo</h2>
        <dl>
          <div><dt>Notícias no radar</dt><dd>{signals.filter((s) => s.status === "approved").length}</dd></div>
          <div><dt>Startups aprovadas</dt><dd>{startups.filter((s) => s.status === "approved").length}</dd></div>
          {canPipeline && <div><dt>No pipeline</dt><dd>{ativas.length}</dd></div>}
          {canPipeline && <div><dt>Investidas</dt><dd>{deals.filter((d) => d.etapa === "investida").length}</dd></div>}
        </dl>
        {isAdmin && <ul className="d2-runs"><Run1 r={lastDaily} label="Recolha diária" /><Run1 r={lastWeekly} label="Recolha semanal" /></ul>}
      </aside>
    </div>
  </div>);
}
