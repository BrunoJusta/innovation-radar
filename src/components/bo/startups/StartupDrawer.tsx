"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { saveStartup, StartupEdit } from "@/lib/startup-actions";
import { FASES, Sector, Startup } from "@/lib/types";
import { fdLongo, relLevel } from "@/lib/util";
import { Gauge } from "../ui";
import { StartupFields } from "./StartupFields";
import { AnaliseView } from "./AnaliseView";
import { nomeTicket } from "@/lib/analise-util";
import { useDeals } from "../pipeline/DealsLookup";
import { createDeal, dealFromStartup, nomeEtapa } from "@/lib/deal-actions";
import { useSession } from "../AuthGate";
import { useAnaliseQueue } from "../AnaliseQueue";

const ORIGEM: Record<string, string> = { pesquisa: "Pesquisa online", noticia: "Notícia", manual: "Adicionada à mão" };
export const pickEdit = (s: Startup): StartupEdit => ({ nome: s.nome, site: s.site, pais: s.pais || "", cidade: s.cidade || "", fundacao: s.fundacao ?? null, fase: s.fase, setor: s.setor,
  descricao: s.descricao || "", porque: s.porque || "", relevancia: s.relevancia, financiamento: s.financiamento || "", investidores: s.investidores || [] });

export function StartupDrawer({ s, list, sectors, onClose, onNav, onApprove, onReason, onStar, onBack, notify }: {
  s: Startup; list: Startup[]; sectors: Sector[]; onClose: () => void; onNav: (id: string) => void;
  onApprove: () => void; onReason: (m: string) => void; onStar: () => void; onBack: () => void; notify: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [f, setF] = useState<StartupEdit>(pickEdit(s));
  const [analise, setAnalise] = useState(false);
  const { dealOf, deals, on: pipeOn } = useDeals();
  const { email } = useSession();
  const { running } = useAnaliseQueue();
  const aCorrer = running.has(`startups/${s.id}`);
  const deal = pipeOn ? dealOf(s) : undefined;
  const toPipeline = async () => {
    try {
      const id = await createDeal(dealFromStartup(s, deals, sectors.find((x) => x.id === s.setor)?.nome || ""), email, "Veio do radar de startups.");
      notify(`«${s.nome}» no pipeline (${id.replace("df-", "")})`);
    } catch { notify("Não foi possível pôr no pipeline. Confirma o acesso e as regras do Firestore."); }
  };
  useEffect(() => { setEditing(false); setRejecting(false); setAnalise(false); setF(pickEdit(s)); }, [s.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !analise) { if (editing) setEditing(false); else if (rejecting) setRejecting(false); else onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [editing, rejecting, analise, onClose]);

  const i = list.findIndex((x) => x.id === s.id);
  const sec = sectors.find((x) => x.id === s.setor), fase = FASES.find((x) => x.id === s.fase);
  const lv = relLevel(s.relevancia);
  const save = async () => {
    if (!f.nome.trim()) return;
    try { await saveStartup(s, f); setEditing(false); notify("Alterações guardadas"); } catch { notify("Não foi possível guardar. Tenta outra vez."); }
  };

  return (<>
    <div className="scrim" onClick={onClose} />
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={s.nome}>
      <div className="dtop"><span className="pos">{i >= 0 ? `${i + 1} de ${list.length}` : ""}</span><span className="sp" />
        <button className="btn icon" title="Anterior" disabled={i <= 0} onClick={() => onNav(list[i - 1].id)}><Icon name="caret-up" /></button>
        <button className="btn icon" title="Seguinte" disabled={i < 0 || i >= list.length - 1} onClick={() => onNav(list[i + 1].id)}><Icon name="caret-down" /></button>
        <button className="btn icon" title="Fechar" onClick={onClose}><Icon name="x" /></button></div>
      <div className="dscroll">
        <div className="dmeta">
          <span className="tg ar" style={{ ["--c" as string]: sec?.cor || "var(--ink-tertiary)" }}>{sec?.nome || "Sem setor"}</span>
          <span className="tg">{fase?.nome}</span>
          {s.status === "approved" && <span className="badge ok"><Icon name="check" />Aprovada</span>}
          {s.status === "rejected" && <span className="badge no"><Icon name="x" />{s.motivoRejeicao}</span>}
          {s.manual && <span className="badge"><Icon name="pencil-simple" />Adicionada à mão</span>}
        </div>
        {editing ? (
          <div className="blk"><div className="bh"><h4>Editar startup</h4>
            <span style={{ display: "flex", gap: 6 }}><button className="txtbtn" onClick={() => setEditing(false)}>Cancelar</button><button className="txtbtn" onClick={save}><Icon name="check" />Guardar alterações</button></span></div>
            <StartupFields value={f} onChange={(p) => setF({ ...f, ...p })} sectors={sectors} />
          </div>
        ) : (<>
          <h2>{s.nome}</h2>
          <a className="sweb" href={s.site} target="_blank" rel="noopener noreferrer">{s.dominio}<Icon name="arrow-up-right" /></a>
          <div className="relbox"><Gauge v={s.relevancia} lg /><div>
            <b>Relevância <span className={`lv-${lv}`}>{({ alta: "alta", media: "média", baixa: "baixa" })[lv]}</span>, {s.relevancia} em 100</b>
            <p className="relnote">{s.porque || "Sem nota sobre o interesse para a Sogrape."}</p>
          </div></div>
          <div className="blk"><div className="bh"><h4>Análise de investimento</h4></div>
            {aCorrer ? (
              <button className="anbox vazio" onClick={() => setAnalise(true)}><span className="spin" aria-hidden="true" />
                <span className="m">A análise de investimento está a correr em segundo plano. Avisamos quando estiver pronta.</span><span className="go">Ver estado</span></button>
            ) : s.analiseResumo ? (
              <button className={`anbox ${s.analiseResumo.decisao}`} onClick={() => setAnalise(true)}>
                <span className="d">{s.analiseResumo.decisao === "investir" ? "Investir" : "Não investir"}</span>
                <span className="m">{nomeTicket(s.analiseResumo.ticket)} · {s.analiseResumo.positivos} de 11 critérios positivos{s.analiseResumo.desafio ? ` · ${s.analiseResumo.desafio}` : ""}</span>
                <span className="m">{fdLongo(s.analiseResumo.feitaEm)}</span>
                <span className="go">Ver análise<Icon name="arrow-up-right" /></span>
              </button>
            ) : (
              <button className="anbox vazio" onClick={() => setAnalise(true)}>
                <Icon name="scales" size={20} /><span className="m">Avalia esta startup com os critérios de investimento da Sogrape Ventures: perfil, 11 critérios, matriz por ticket e decisão.</span>
                <span className="go">Fazer análise<Icon name="sparkle" /></span>
              </button>
            )}
          </div>
          {pipeOn && <div className="blk"><div className="bh"><h4>Pipeline da Sogrape Ventures</h4></div>
            {deal ? (
              <div className="pipebox"><Icon name="kanban" size={18} />
                <span><b>{deal.etapa === "arquivada" ? "Arquivada no pipeline" : `No pipeline: ${nomeEtapa(deal.etapa)}`}</b>
                  {deal.etapa === "arquivada" && deal.arquivo?.em ? ` em ${fdLongo(deal.arquivo.em)}` : ""}{deal.ref ? ` · ${deal.ref}` : ""}
                  {deal.proximaAcao ? <em>Próximo passo: {deal.proximaAcao}</em> : null}</span></div>
            ) : (
              <button className="anbox vazio" onClick={toPipeline}><Icon name="kanban" size={20} />
                <span className="m">Começar o seguimento desta startup: fase, próximo passo, reuniões e ronda.</span>
                <span className="go">Pôr no pipeline<Icon name="plus" /></span></button>
            )}
          </div>}
          <div className="blk"><div className="bh"><h4>Ficha</h4>{s.status !== "rejected" && <button className="txtbtn" onClick={() => setEditing(true)}><Icon name="pencil-simple" />Editar</button>}</div>
            <dl className="facts">
              <div><dt>País</dt><dd>{[s.cidade, s.pais].filter(Boolean).join(", ") || "Sem dados"}</dd></div>
              <div><dt>Fundação</dt><dd>{s.fundacao || "Sem dados"}</dd></div>
              <div><dt>Fase</dt><dd>{fase?.nome}</dd></div>
              <div><dt>Financiamento</dt><dd>{s.financiamento || "Sem dados"}</dd></div>
            </dl>
          </div>
          <div className="blk"><div className="bh"><h4>O que faz</h4></div><div className="summary"><p>{s.descricao}</p></div></div>
          {s.investidores?.length > 0 && <div className="blk"><div className="bh"><h4>Investidores</h4></div><div className="ents">{s.investidores.map((e) => <span key={e} className="badge">{e}</span>)}</div></div>}
          <div className="blk"><div className="bh"><h4>Onde a encontrámos</h4></div><div className="sources">
            {(s.origens || []).map((o) => (
              <a key={o.url} className="s" href={o.url} target="_blank" rel="noopener noreferrer">
                <span className="mono"><Icon name={o.tipo === "noticia" ? "tray" : o.tipo === "manual" ? "pencil-simple" : "magnifying-glass"} /></span>
                <span className="t">{o.titulo}</span><span className="go"><Icon name="arrow-up-right" /></span>
                <span className="m"><span>{ORIGEM[o.tipo]}{o.pesquisa ? `: «${o.pesquisa}»` : ""}, {fdLongo(o.data)}</span></span>
              </a>
            ))}
          </div></div>
        </>)}
      </div>
      <div className="dbar">
        {s.status === "pending" ? (rejecting ? (
          <div className="reasons"><div className="rh">Porque rejeitas?<button className="txtbtn" onClick={() => setRejecting(false)}>Cancelar</button></div>
            <div className="rgrid">{SREJECT.map((m) => <button key={m} onClick={() => onReason(m)}>{m}</button>)}</div></div>
        ) : (<>
          <button className="btn primary lg" onClick={onApprove}><Icon name="check" />Aprovar</button>
          <button className="btn lg" onClick={() => setRejecting(true)}><Icon name="x" />Rejeitar</button><span className="sp" />
          <button className="btn lg icon" aria-pressed={!!s.destaque} title="Destacar" onClick={onStar}><Icon name={s.destaque ? "star-fill" : "star"} /></button>
          <button className="btn lg icon" title="Editar" onClick={() => setEditing(true)}><Icon name="pencil-simple" /></button>
        </>)) : (<>
          <button className="btn lg" onClick={onBack}><Icon name="arrow-u-up-left" />Voltar à triagem</button><span className="sp" />
          {s.status === "approved" && <button className="btn lg icon" aria-pressed={!!s.destaque} title="Destacar" onClick={onStar}><Icon name={s.destaque ? "star-fill" : "star"} /></button>}
        </>)}
      </div>
    </aside>
    {analise && <AnaliseView alvo={alvoStartup(s, sec?.nome)} onClose={() => setAnalise(false)} notify={notify} />}
  </>);
}

export const alvoStartup = (s: Startup, setor = "") => ({ path: `startups/${s.id}`, nome: s.nome, site: s.site, dominio: s.dominio, descricao: s.descricao, setor });

export const SREJECT = ["Fora de tema", "Pouco relevante", "Não é startup", "Já não existe"];
