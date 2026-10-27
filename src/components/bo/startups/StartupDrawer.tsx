"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { approveStartup, saveStartup, saveStartupLink, StartupEdit } from "@/lib/startup-actions";
import { Area, FASES, Sector, Startup, nomeDecisao } from "@/lib/types";
import { fdLongo, relLevel } from "@/lib/util";
import { Gauge } from "../ui";
import { StartupFields } from "./StartupFields";
import { LogoEditor } from "./Logo";
import { AnaliseView } from "./AnaliseView";
import { nomeTicket } from "@/lib/analise-util";
import { useDeals } from "../pipeline/DealsLookup";
import { createDeal, dealFromStartup, nomeEtapa } from "@/lib/deal-actions";
import { useSession } from "../AuthGate";
import { useAnaliseQueue } from "../AnaliseQueue";

const ORIGEM: Record<string, string> = { pesquisa: "Pesquisa online", noticia: "Notícia", manual: "Adicionada manualmente" };
export const pickEdit = (s: Startup): StartupEdit => ({ nome: s.nome, site: s.site, pais: s.pais || "", cidade: s.cidade || "", fundacao: s.fundacao ?? null, fase: s.fase, setor: s.setor, cadeia: s.cadeia,
  descricao: s.descricao || "", porque: s.porque || "", relevancia: s.relevancia, financiamento: s.financiamento || "", investidores: s.investidores || [] });

export function StartupDrawer({ s, list, sectors, areas, onClose, onNav, onApprove, onReason, onBack, onDelete, notify }: {
  s: Startup; list: Startup[]; sectors: Sector[]; areas: Area[]; onClose: () => void; onNav: (id: string) => void;
  onApprove: () => void; onReason: (m: string) => void; onBack: () => void; /** Eliminar de vez (triagem e arquivo de triagem) */ onDelete?: () => void; notify: (m: string) => void;
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
      // Fica registada como aprovada (se ainda não estava) e ligada ao pipeline; sai da lista de Aprovadas
      if (s.status !== "approved") await approveStartup(s, email);
      await saveStartupLink(s.id, id);
      notify(`«${s.nome}» passou para o pipeline (${id.replace("df-", "")}). Aparece no radar de startups.`);
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
  const sec = sectors.find((x) => x.id === s.setor), fase = FASES.find((x) => x.id === s.fase), cad = areas.find((x) => x.id === s.cadeia);
  const lv = relLevel(s.relevancia);
  const save = async () => {
    if (!f.nome.trim()) return;
    try { await saveStartup(s, f); setEditing(false); notify("Alterações guardadas"); } catch { notify("Não foi possível guardar. Tenta outra vez."); }
  };

  return (<>
    <div className="scrim" onClick={onClose} />
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={s.nome}>
      <div className="dtop"><span className="pos">{i >= 0 ? `${i + 1} de ${list.length}` : ""}</span><span className="sp" />
        <button className="btn icon" title="Anterior" aria-label="Anterior" disabled={i <= 0} onClick={() => onNav(list[i - 1].id)}><Icon name="caret-up" /></button>
        <button className="btn icon" title="Seguinte" aria-label="Seguinte" disabled={i < 0 || i >= list.length - 1} onClick={() => onNav(list[i + 1].id)}><Icon name="caret-down" /></button>
        <button className="btn icon" title="Fechar" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button></div>
      <div className="dscroll">
        <div className="dmeta">
          <span className="tg ar" style={{ ["--c" as string]: sec?.cor || "var(--ink-tertiary)" }}>{sec?.nome || "Sem categoria"}</span>
          {cad && <span className="tg"><i className="cdot" style={{ background: cad.cor }} />{cad.nome}</span>}
          <span className="tg">{fase?.nome}</span>
          {s.status === "approved" && <span className="badge ok"><Icon name="check" />Aprovada</span>}
          {s.status === "rejected" && <span className="badge no"><Icon name="prohibit" />Arquivo de triagem: {s.motivoRejeicao}</span>}
          {s.manual && <span className="badge"><Icon name="pencil-simple" />Adicionada manualmente</span>}
        </div>
        {editing ? (
          <div className="blk"><div className="bh"><h4>Editar startup</h4>
            <span style={{ display: "flex", gap: 6 }}><button className="txtbtn" onClick={() => setEditing(false)}>Cancelar</button><button className="txtbtn" onClick={save}><Icon name="check" />Guardar alterações</button></span></div>
            <StartupFields value={f} onChange={(p) => setF({ ...f, ...p })} sectors={sectors} areas={areas} />
          </div>
        ) : (<>
          <LogoEditor nome={s.nome} logo={s.logo} site={s.site} alvo={{ startupId: s.id, dealId: deal?.id || s.dealId }} notify={notify} />
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
                <span className="d">{nomeDecisao(s.analiseResumo.decisao)}</span>
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
                <span className="m">{s.passosEmEspera?.passos?.length
                  ? "Voltar a seguir esta startup no Pipeline. Os próximos passos em espera voltam a ficar ativos."
                  : "Começar o seguimento desta startup: fase, próximo passo, reuniões e ronda. Sai da lista de Aprovadas e passa a ser acompanhada no Pipeline."}</span>
                <span className="go">Pôr no pipeline<Icon name="plus" /></span></button>
            )}
            {!deal && !!s.passosEmEspera?.passos?.length && (
              <div className="espera">
                <div className="espera-h"><Icon name="clock" /><b>Próximos passos em espera</b>
                  <span>Desde {fdLongo(s.passosEmEspera.desde)}, quando saiu de {nomeEtapa(s.passosEmEspera.etapa)}{s.passosEmEspera.ref ? ` (${s.passosEmEspera.ref})` : ""}</span></div>
                <ul className="passos">{s.passosEmEspera.passos.map((p) => (
                  <li key={p.id} className="passo hold"><div className="pb"><b>{p.texto || "Sem descrição"}</b>
                    <span className="pm">{p.prazo && <span className="pz"><Icon name="calendar-blank" />{fdLongo(p.prazo)}</span>}{p.responsavel && <em>{p.responsavel.split("@")[0]}</em>}</span></div></li>))}</ul>
              </div>
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
          <div className="reasons"><div className="rh">Porque arquivas? Vai para o arquivo de triagem.<button className="txtbtn" onClick={() => setRejecting(false)}>Cancelar</button></div>
            <div className="rgrid">{SREJECT.map((m) => <button key={m} onClick={() => onReason(m)}>{m}</button>)}</div></div>
        ) : (<>
          <button className="btn primary lg" onClick={onApprove}><Icon name="check" />Aprovar</button>
          <button className="btn lg" onClick={() => setRejecting(true)}><Icon name="prohibit" />Arquivar</button>
          {onDelete && <button className="btn lg" onClick={onDelete}><Icon name="trash" />Eliminar</button>}<span className="sp" />
          <button className="btn lg icon" title="Editar" aria-label="Editar" onClick={() => setEditing(true)}><Icon name="pencil-simple" /></button>
        </>)) : (<>
          <button className="btn lg" onClick={onBack}><Icon name="arrow-u-up-left" />Voltar à triagem</button>
          {s.status === "rejected" && onDelete && <button className="btn lg" onClick={onDelete}><Icon name="trash" />Eliminar</button>}<span className="sp" />
        </>)}
      </div>
    </aside>
    {analise && <AnaliseView alvo={alvoStartup(s, sec?.nome)} onClose={() => setAnalise(false)} notify={notify} />}
  </>);
}

export const alvoStartup = (s: Startup, setor = "") => ({ path: `startups/${s.id}`, nome: s.nome, site: s.site, dominio: s.dominio, descricao: s.descricao, setor, logo: s.logo, ...(s.dealId ? { alsoResumo: `deals/${s.dealId}` } : {}) });

export const SREJECT = ["Fora de tema", "Pouco relevante", "Não é startup", "Já não existe"];
