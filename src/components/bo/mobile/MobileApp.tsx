"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { nomeTicket } from "@/lib/analise-util";
import { nomeEtapa, passosAbertos } from "@/lib/deal-actions";
import { Deal, ETAPAS_ATIVAS, Interacao, TIPOS_INTERACAO, VERTICAIS_DF, VEZES } from "@/lib/types";
import { fdCurto, fdLongo, nDias } from "@/lib/util";
import { logout, useSession } from "../AuthGate";
import { DealsLookup, useDeals } from "../pipeline/DealsLookup";
import { diasDesde, estadoPrazo, prazoEstado } from "../pipeline/PipelineBoard";
import { PipelineCalendar } from "../pipeline/PipelineCalendar";
import { fmtEur } from "../pipeline/DealFields";

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Vista rápida para telemóvel: só leitura, para acompanhar o pipeline no dia a dia. */
export function MobileApp({ onFull }: { onFull: () => void }) {
  const { canPipeline, profile, email } = useSession();
  return (
    <div className="mob">
      <header className="mob-h">
        <span className="mob-brand"><img src="/icon-192.png" alt="" width={24} height={24} />Radar</span>
        <span className="sp" />
        <span className="mob-me" title={email}>{(profile.nome || email).split(/[\s@.]/)[0]}</span>
        <button className="btn icon" aria-label="Abrir a versão completa" title="Versão completa" onClick={onFull}><Icon name="monitor" /></button>
        <button className="btn icon" aria-label="Sair" title="Sair" onClick={() => logout()}><Icon name="sign-out" /></button>
      </header>
      {canPipeline ? <DealsLookup><MobilePipeline /></DealsLookup> : (
        <div className="mob-empty">
          <h1>Vista rápida</h1>
          <p>No telemóvel, o Radar mostra o pipeline da Sogrape Ventures, que é só para administradores. Para o resto do backoffice usa a versão completa.</p>
          <button className="btn primary lg" onClick={onFull}><Icon name="monitor" />Abrir a versão completa</button>
        </div>
      )}
    </div>
  );
}

function MobilePipeline() {
  const { deals, loaded, erro } = useDeals();
  const [tab, setTab] = useState<"agenda" | "pipeline">("agenda");
  const [q, setQ] = useState("");
  const [fase, setFase] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const ativas = useMemo(() => deals.filter((d) => d.etapa !== "arquivada"), [deals]);
  const late = ativas.filter((d) => prazoEstado(d) === "atrasado").length;
  const lista = useMemo(() => {
    const k = norm(q.trim());
    return ativas.filter((d) => (fase === "all" || d.etapa === fase) && (!k || norm([d.nome, d.proximaAcao, d.pais, d.responsavel].join(" ")).includes(k)));
  }, [ativas, q, fase]);
  const open = deals.find((d) => d.id === openId);

  if (!loaded) return <div className="loading">A carregar…</div>;
  if (erro) return <div className="mob-empty"><p>{erro}</p></div>;

  return (<>
    <div className="mob-sum">
      <div><b>{ativas.length}</b><span>em curso</span></div>
      <div className={late ? "late" : ""}><b>{late}</b><span>{late === 1 ? "atrasada" : "atrasadas"}</span></div>
      <div><b>{ativas.filter((d) => d.vez === "sogrape").length}</b><span>à espera da Sogrape</span></div>
    </div>
    <nav className="mob-tabs seg" aria-label="Vista">
      <button aria-pressed={tab === "agenda"} onClick={() => setTab("agenda")}><Icon name="calendar-blank" />Agenda</button>
      <button aria-pressed={tab === "pipeline"} onClick={() => setTab("pipeline")}><Icon name="kanban" />Pipeline</button>
    </nav>

    {tab === "agenda" ? <PipelineCalendar deals={ativas} onOpen={setOpenId} compact /> : (<>
      <label className="fsearch mob-s"><Icon name="magnifying-glass" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar startups…" aria-label="Pesquisar startups" autoComplete="off" spellCheck={false} /></label>
      <div className="mob-chips" role="group" aria-label="Fase">
        <button aria-pressed={fase === "all"} onClick={() => setFase("all")}>Todas</button>
        {ETAPAS_ATIVAS.map((e) => { const n = ativas.filter((d) => d.etapa === e.id).length; return n ? <button key={e.id} aria-pressed={fase === e.id} onClick={() => setFase(e.id)}>{e.nome}<span>{n}</span></button> : null; })}
      </div>
      {ETAPAS_ATIVAS.map((e) => {
        const l = lista.filter((d) => d.etapa === e.id);
        if (!l.length) return null;
        return <section key={e.id} className="mob-sec"><h2>{e.nome}<span>{l.length}</span></h2>
          <ul className="mob-list">{l.map((d) => {
            const pz = prazoEstado(d), vez = VEZES.find((v) => v.id === d.vez), mais = passosAbertos(d).length - 1;
            return <li key={d.id}><button onClick={() => setOpenId(d.id)} className={pz === "atrasado" ? "late" : ""}>
              <span className="r1"><b>{d.nome}</b>{d.prazo && <span className={`pz ${pz === "atrasado" ? "late" : pz === "breve" ? "soon" : ""}`}>{fdCurto(d.prazo)}</span>}</span>
              <span className="r2">{d.proximaAcao || "Sem próximo passo definido"}{mais > 0 && <span className="pmais"> +{mais}</span>}</span>
              <span className="r3">{vez && <span className={`vez v-${vez.id}`}>{vez.curto}</span>}<em>{nDias(diasDesde(d.etapaDesde))} na fase</em></span>
            </button></li>;
          })}</ul></section>;
      })}
      {!lista.length && <p className="dempty mob-pad">Nada encontrado.</p>}
    </>)}
    {open && <MobileDeal d={open} onClose={() => setOpenId(null)} />}
  </>);
}

/** Ficha só de leitura, em folha que sobe do fundo do ecrã. */
function MobileDeal({ d, onClose }: { d: Deal; onClose: () => void }) {
  const [ints, setInts] = useState<Interacao[] | null>(null);
  useEffect(() => onSnapshot(query(collection(db, "deals", d.id, "interacoes"), orderBy("data", "desc"), limit(8)),
    (s) => setInts(s.docs.map((x) => ({ id: x.id, ...x.data() }) as Interacao)), () => setInts([])), [d.id]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", k); };
  }, [onClose]);
  const abertos = passosAbertos(d);
  const vert = VERTICAIS_DF.find((v) => v.id === d.vertical)?.nome;
  return (<>
    <div className="scrim" onClick={onClose} />
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="ms-t">
      <div className="sheet-grab" aria-hidden="true" />
      <div className="sheet-h"><div><h2 id="ms-t">{d.nome}</h2><span>{[nomeEtapa(d.etapa), vert, d.pais].filter(Boolean).join(" · ")}</span></div>
        <button className="btn icon" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button></div>
      <div className="sheet-b">
        {abertos.length === 0 ? <div className="mob-next"><span className="lbl">Próximos passos</span><p>Sem próximos passos definidos</p></div> : abertos.map((p, k) => {
          const vez = VEZES.find((v) => v.id === p.vez), pz = estadoPrazo(p.prazo);
          return <div key={p.id} className={`mob-next${pz === "atrasado" ? " late" : ""}`}>
            {k === 0 && <span className="lbl">{abertos.length === 1 ? "Próximo passo" : `Próximos passos · ${abertos.length}`}</span>}
            <p>{p.texto || "Sem descrição"}</p>
            <div>{vez && <span className={`vez v-${vez.id}`}>{vez.nome}</span>}
              {p.prazo && <span className={`pz ${pz === "atrasado" ? "late" : pz === "breve" ? "soon" : ""}`}><Icon name="calendar-blank" />{fdLongo(p.prazo)}</span>}
              {p.responsavel && <em>{p.responsavel.split("@")[0]}</em>}</div>
          </div>;
        })}
        <dl className="mob-facts">
          <div><dt>Na fase</dt><dd>{nDias(diasDesde(d.etapaDesde))}</dd></div>
          <div><dt>Ronda</dt><dd>{fmtEur(d.ronda?.valor) || "Sem dados"}</dd></div>
          <div><dt>Ticket</dt><dd>{fmtEur(d.ronda?.ticket) || "Sem dados"}</dd></div>
          {d.analiseResumo && <div><dt>Análise</dt><dd className={d.analiseResumo.decisao === "investir" ? "ok" : "no"}>{d.analiseResumo.decisao === "investir" ? "Investir" : "Não investir"}{d.analiseResumo.ticket ? ` · ${nomeTicket(d.analiseResumo.ticket)}` : ""}</dd></div>}
        </dl>
        {d.descricao && <p className="mob-desc">{d.descricao}</p>}
        {d.site && <a className="btn mob-site" href={d.site} target="_blank" rel="noopener noreferrer"><Icon name="globe" />{d.dominio || d.site}</a>}
        <h3>Últimos registos</h3>
        {ints === null ? <p className="dempty">A carregar…</p> : !ints.length ? <p className="dempty">Ainda não há nada registado.</p> : (
          <ul className="mob-tl">{ints.map((x) => { const t = TIPOS_INTERACAO.find((k) => k.id === x.tipo); return (
            <li key={x.id}><span className="d">{x.data ? fdCurto(x.data) : ""}</span><div><b>{t?.nome}</b><p>{x.texto}</p></div></li>); })}</ul>
        )}
      </div>
    </div>
  </>);
}
