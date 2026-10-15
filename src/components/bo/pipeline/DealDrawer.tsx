"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { nomeTicket } from "@/lib/analise-util";
import { addInteracao, archiveDeal, delInteracao, moveDeal, reopenDeal, saveDeal } from "@/lib/deal-actions";
import { AlvoAnalise } from "@/lib/analise-run";
import { Deal, ETAPAS, ETAPAS_ATIVAS, Etapa, FASES_DF, Interacao, MOTIVOS_ARQUIVO, MotivoArquivo, ORIGENS_DF, TIPOS_INTERACAO, TipoInteracao, VERTICAIS_DF, VEZES, Vez } from "@/lib/types";
import { fdLongo } from "@/lib/util";
import { useSession } from "../AuthGate";
import { AnaliseView } from "../startups/AnaliseView";
import { DealEdit, DealFields, fmtEur, pickDeal } from "./DealFields";
import { diasDesde, prazoEstado } from "./PipelineBoard";

const nm = <T extends { id: string; nome: string }>(l: T[], id: string | null | undefined) => l.find((x) => x.id === id)?.nome || "";
const hoje = () => new Date().toISOString().slice(0, 10);

export const alvoDeal = (d: Deal): AlvoAnalise => d.startupId
  ? { path: `startups/${d.startupId}`, alsoResumo: `deals/${d.id}`, nome: d.nome, site: d.site, dominio: d.dominio, descricao: d.descricao, setor: nm(VERTICAIS_DF, d.vertical) }
  : { path: `deals/${d.id}`, nome: d.nome, site: d.site, dominio: d.dominio, descricao: d.descricao, setor: nm(VERTICAIS_DF, d.vertical) };

/** Ficha de uma startup no pipeline: fase, próximo passo, análise, ficha, ronda e cronologia. */
export function DealDrawer({ d, list, origens, pessoas, onClose, onNav, notify }: {
  d: Deal; list: Deal[]; origens: string[]; pessoas: string[]; onClose: () => void; onNav: (id: string) => void; notify: (m: string) => void;
}) {
  const { email } = useSession();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<DealEdit>(pickDeal(d));
  const [archiving, setArchiving] = useState(false);
  const [motivo, setMotivo] = useState<MotivoArquivo | "">("");
  const [notaArq, setNotaArq] = useState("");
  const [analise, setAnalise] = useState(false);
  const [ints, setInts] = useState<Interacao[] | null>(null);
  const [nova, setNova] = useState<{ tipo: TipoInteracao; data: string; texto: string; participantes: string } | null>(null);
  const [next, setNext] = useState({ vez: d.vez, proximaAcao: d.proximaAcao, prazo: d.prazo || "", responsavel: d.responsavel });
  const dirty = next.vez !== d.vez || next.proximaAcao !== d.proximaAcao || (next.prazo || null) !== (d.prazo || null) || next.responsavel !== d.responsavel;

  useEffect(() => { setEditing(false); setArchiving(false); setNova(null); setF(pickDeal(d)); setNext({ vez: d.vez, proximaAcao: d.proximaAcao, prazo: d.prazo || "", responsavel: d.responsavel }); }, [d.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setNext({ vez: d.vez, proximaAcao: d.proximaAcao, prazo: d.prazo || "", responsavel: d.responsavel }); }, [d.vez, d.proximaAcao, d.prazo, d.responsavel]);
  useEffect(() => onSnapshot(query(collection(db, "deals", d.id, "interacoes"), orderBy("data", "desc")),
    (s) => setInts(s.docs.map((x) => ({ id: x.id, ...x.data() }) as Interacao)), () => setInts([])), [d.id]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !analise) { if (editing) setEditing(false); else if (archiving) setArchiving(false); else if (nova) setNova(null); else onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [editing, archiving, nova, analise, onClose]);

  const i = list.findIndex((x) => x.id === d.id);
  const act = (p: Promise<unknown>, msg: string) => p.then(() => notify(msg)).catch((e) => notify((e as { code?: string }).code === "permission-denied" ? "Sem permissão para alterar o pipeline." : "Não foi possível guardar. Tenta outra vez."));
  const saveFicha = () => { if (!f.nome.trim()) return; act(saveDeal(d, { ...f, dominio: (f.site || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase() }).then(() => setEditing(false)), "Ficha guardada"); };
  const saveNext = () => act(saveDeal(d, { vez: next.vez, proximaAcao: next.proximaAcao.trim(), prazo: next.prazo || null, responsavel: next.responsavel.trim() }), "Próximo passo guardado");
  const pz = prazoEstado(d);
  const ativa = d.etapa !== "arquivada";
  const etapaIdx = ETAPAS_ATIVAS.findIndex((e) => e.id === d.etapa);
  const grupos = useMemo(() => {
    const m = new Map<string, Interacao[]>();
    (ints || []).forEach((x) => { const k = (x.data || "").slice(0, 7); m.set(k, [...(m.get(k) || []), x]); });
    return [...m.entries()];
  }, [ints]);

  return (<>
    <div className="scrim" onClick={onClose} />
    <aside className="drawer dd" role="dialog" aria-modal="true" aria-label={d.nome}>
      <div className="dtop"><span className="pos">{i >= 0 ? `${i + 1} de ${list.length}` : ""}</span><span className="sp" />
        <button className="btn icon" title="Anterior" disabled={i <= 0} onClick={() => onNav(list[i - 1].id)}><Icon name="caret-up" /></button>
        <button className="btn icon" title="Seguinte" disabled={i < 0 || i >= list.length - 1} onClick={() => onNav(list[i + 1].id)}><Icon name="caret-down" /></button>
        <button className="btn icon" title="Fechar" onClick={onClose}><Icon name="x" /></button></div>
      <div className="dscroll">
        <div className="dmeta">
          {d.ref && <span className="tg mn">{d.ref}</span>}
          {d.vertical && <span className="tg">{nm(VERTICAIS_DF, d.vertical)}</span>}
          {d.fase && <span className="tg">{nm(FASES_DF, d.fase)}</span>}
          {d.pais && <span className="tg">{d.pais}</span>}
          {d.interesse === "outro" && <span className="tg">Outra relação</span>}
          {d.startupId && <span className="badge"><Icon name="globe" />No radar de startups</span>}
        </div>
        <h2>{d.nome}</h2>
        {d.site ? <a className="sweb" href={d.site} target="_blank" rel="noopener noreferrer">{d.dominio || d.site}<Icon name="arrow-up-right" /></a> : <span className="sweb mut">Sem site registado</span>}

        {/* Fase */}
        {ativa ? (
          <div className="stepper" role="group" aria-label="Fase do pipeline">
            {ETAPAS_ATIVAS.map((e, k) => (
              <button key={e.id} className={k < etapaIdx ? "done" : k === etapaIdx ? "on" : ""} title={e.desc} aria-current={k === etapaIdx}
                onClick={() => k !== etapaIdx && act(moveDeal(d, e.id as Etapa, email), `Passou para ${e.nome}`)}>
                <span className="b" /><span className="l">{e.nome}</span></button>
            ))}
          </div>
        ) : (
          <div className="arqbox"><Icon name="prohibit" />
            <div><b>Arquivada{d.arquivo?.em ? ` em ${fdLongo(d.arquivo.em)}` : ""}: {nm(MOTIVOS_ARQUIVO, d.arquivo?.motivo)}</b>
              {d.arquivo?.nota && <p>{d.arquivo.nota}</p>}
              {d.arquivo?.etapaAnterior && <span>Estava em {nm(ETAPAS, d.arquivo.etapaAnterior)}</span>}</div></div>
        )}
        <p className="since">{ativa ? `Em ${nm(ETAPAS, d.etapa)} há ${diasDesde(d.etapaDesde)} dias · ` : ""}Entrou em {fdLongo(d.entrada)}</p>

        {/* Próximo passo */}
        {ativa && <div className={`blk nextbox${pz === "atrasado" ? " late" : ""}`}><div className="bh"><h4>Próximo passo</h4>{pz === "atrasado" && <span className="pz late">Atrasado</span>}</div>
          <div className="seg vezseg" role="group" aria-label="De quem é a vez">
            {VEZES.map((v) => <button key={v.id} aria-pressed={next.vez === v.id} onClick={() => setNext({ ...next, vez: next.vez === v.id ? null : v.id as Vez })}>{v.curto}</button>)}
          </div>
          <div className="fgrid">
            <label className="fld wide"><span>O que falta fazer</span><input value={next.proximaAcao} onChange={(e) => setNext({ ...next, proximaAcao: e.target.value })} placeholder="ex.: enviar o deck à Beta Capital" /></label>
            <label className="fld"><span>Prazo</span><input type="date" value={next.prazo} onChange={(e) => setNext({ ...next, prazo: e.target.value })} /></label>
            <label className="fld"><span>Responsável</span><input list="df-pessoas" value={next.responsavel} onChange={(e) => setNext({ ...next, responsavel: e.target.value })} placeholder="nome ou email" />
              <datalist id="df-pessoas">{pessoas.map((p) => <option key={p} value={p} />)}</datalist></label>
          </div>
          {dirty && <div className="factions"><button className="txtbtn" onClick={() => setNext({ vez: d.vez, proximaAcao: d.proximaAcao, prazo: d.prazo || "", responsavel: d.responsavel })}>Cancelar</button>
            <button className="btn primary" onClick={saveNext}><Icon name="check" />Guardar</button></div>}
        </div>}

        {/* Análise */}
        <div className="blk"><div className="bh"><h4>Análise de investimento</h4></div>
          {d.analiseResumo ? (
            <button className={`anbox ${d.analiseResumo.decisao}`} onClick={() => setAnalise(true)}>
              <span className="d">{d.analiseResumo.decisao === "investir" ? "Investir" : "Não investir"}</span>
              <span className="m">{nomeTicket(d.analiseResumo.ticket)} · {d.analiseResumo.positivos} de 11 critérios positivos{d.analiseResumo.desafio ? ` · ${d.analiseResumo.desafio}` : ""}</span>
              <span className="m">{fdLongo(d.analiseResumo.feitaEm)}</span>
              <span className="go">Ver análise<Icon name="arrow-up-right" /></span>
            </button>
          ) : (
            <button className="anbox vazio" onClick={() => setAnalise(true)}>
              <Icon name="scales" size={20} /><span className="m">{d.site ? "Avalia com os critérios da Sogrape Ventures: perfil, 11 critérios, matriz por ticket e decisão." : "Sem site a análise fica mais pobre. Acrescenta o site na ficha antes de analisar."}</span>
              <span className="go">Fazer análise<Icon name="sparkle" /></span>
            </button>
          )}
        </div>

        {/* Ficha */}
        {editing ? (
          <div className="blk"><div className="bh"><h4>Editar ficha</h4>
            <span style={{ display: "flex", gap: 6 }}><button className="txtbtn" onClick={() => setEditing(false)}>Cancelar</button><button className="txtbtn" onClick={saveFicha}><Icon name="check" />Guardar</button></span></div>
            <DealFields value={f} onChange={(p) => setF({ ...f, ...p })} origens={origens} />
          </div>
        ) : (<>
          <div className="blk"><div className="bh"><h4>Ficha</h4><button className="txtbtn" onClick={() => { setF(pickDeal(d)); setEditing(true); }}><Icon name="pencil-simple" />Editar</button></div>
            {d.descricao && <div className="summary"><p>{d.descricao}</p></div>}
            <dl className="facts">
              <div><dt>Fundadores</dt><dd>{d.fundadores || "Sem dados"}</dd></div>
              <div><dt>Origem</dt><dd>{[nm(ORIGENS_DF, d.origem?.tipo), d.origem?.nome !== nm(ORIGENS_DF, d.origem?.tipo) ? d.origem?.nome : ""].filter(Boolean).join(" · ")}{d.origem?.contacto ? ` (via ${d.origem.contacto})` : ""}</dd></div>
            </dl>
          </div>
          <div className="blk"><div className="bh"><h4>Ronda</h4></div>
            <dl className="facts">
              <div><dt>Valuation</dt><dd>{fmtEur(d.ronda?.valuation) || "Sem dados"}</dd></div>
              <div><dt>Ronda</dt><dd>{fmtEur(d.ronda?.valor) || "Sem dados"}</dd></div>
              <div><dt>Ticket da Sogrape</dt><dd>{fmtEur(d.ronda?.ticket) || "Sem dados"}</dd></div>
              <div><dt>Lead</dt><dd>{d.ronda?.lead || "Sem dados"}</dd></div>
            </dl>
            {(d.ronda?.coinvestidores?.length > 0 || d.ronda?.notas) && <p className="rnotes">{[d.ronda.coinvestidores.length ? `Coinvestidores: ${d.ronda.coinvestidores.join(", ")}` : "", d.ronda.notas].filter(Boolean).join(". ")}</p>}
          </div>
          {d.documentos?.length > 0 && <div className="blk"><div className="bh"><h4>Documentos</h4></div><div className="sources">
            {d.documentos.filter((x) => x.url).map((x) => <a key={x.url} className="s" href={x.url} target="_blank" rel="noopener noreferrer">
              <span className="mono"><Icon name="stack" /></span><span className="t">{x.titulo || x.url}</span><span className="go"><Icon name="arrow-up-right" /></span></a>)}
          </div></div>}
        </>)}

        {/* Cronologia */}
        <div className="blk"><div className="bh"><h4>Cronologia</h4>{!nova && <button className="txtbtn" onClick={() => setNova({ tipo: "reuniao", data: hoje(), texto: "", participantes: "" })}><Icon name="plus" />Registar</button>}</div>
          {nova && (
            <div className="newint">
              <div className="seg" role="group" aria-label="Tipo">{TIPOS_INTERACAO.filter((t) => t.id !== "etapa").map((t) =>
                <button key={t.id} aria-pressed={nova.tipo === t.id} onClick={() => setNova({ ...nova, tipo: t.id })}><Icon name={t.icon} />{t.nome}</button>)}</div>
              <div className="fgrid">
                <label className="fld"><span>Data</span><input type="date" value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} /></label>
                <label className="fld"><span>Participantes</span><input value={nova.participantes} onChange={(e) => setNova({ ...nova, participantes: e.target.value })} placeholder="opcional" /></label>
              </div>
              <label className="fld full"><span>O que aconteceu</span><textarea autoFocus rows={4} value={nova.texto} onChange={(e) => setNova({ ...nova, texto: e.target.value })}
                placeholder="ex.: Intro meeting. Apresentaram a ronda de 1,5 M€; ficámos de partilhar o deck com a BC." /></label>
              <div className="factions"><button className="txtbtn" onClick={() => setNova(null)}>Cancelar</button>
                <button className="btn primary" disabled={!nova.texto.trim()} onClick={() => act(addInteracao(d.id, { tipo: nova.tipo, data: nova.data, texto: nova.texto.trim(), participantes: nova.participantes.trim() || undefined, por: email })
                  .then(() => saveDeal(d, {})).then(() => setNova(null)), "Registado na cronologia")}><Icon name="check" />Registar</button></div>
            </div>
          )}
          {ints === null ? <p className="hint">A carregar…</p> : ints.length === 0 && !nova ? <p className="hint">Ainda não há nada registado. Regista reuniões, emails, documentos recebidos e o feedback da Beta Capital.</p> : (
            <ol className="tl">{grupos.map(([mes, xs]) => (
              <li key={mes} className="tlm"><span className="tlh">{mes ? new Date(mes + "-01").toLocaleDateString("pt-PT", { month: "long", year: "numeric" }) : "Sem data"}</span>
                <ol>{xs.map((x) => {
                  const t = TIPOS_INTERACAO.find((k) => k.id === x.tipo);
                  return <li key={x.id} className={`tli t-${x.tipo}`}>
                    <span className="tld"><Icon name={t?.icon || "pencil-simple"} /></span>
                    <div className="tlb"><div className="tlt"><b>{t?.nome}</b><span>{x.data ? fdLongo(x.data) : ""}{x.participantes ? ` · ${x.participantes}` : ""}{x.por ? ` · ${x.por === "Excel" ? "importado do Excel" : x.por.split("@")[0]}` : ""}</span>
                      {x.tipo !== "etapa" && (x.por === email || x.por === "Excel") && <button className="tlx" title="Apagar" aria-label="Apagar registo" onClick={() => act(delInteracao(d.id, x.id), "Registo apagado")}><Icon name="trash" /></button>}</div>
                      <p>{x.texto}</p></div>
                  </li>;
                })}</ol></li>
            ))}</ol>
          )}
        </div>
      </div>
      <div className="dbar">
        {ativa ? (archiving ? (
          <div className="reasons"><div className="rh">Porque arquivas?<button className="txtbtn" onClick={() => setArchiving(false)}>Cancelar</button></div>
            <div className="rgrid">{MOTIVOS_ARQUIVO.filter((m) => m.id !== "sem-registo").map((m) => <button key={m.id} aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)}>{m.nome}</button>)}</div>
            <div className="arqf"><input value={notaArq} onChange={(e) => setNotaArq(e.target.value)} placeholder="Nota (opcional): o que foi comunicado à startup" />
              <button className="btn primary" disabled={!motivo} onClick={() => motivo && act(archiveDeal(d, motivo, notaArq.trim(), email).then(() => { setArchiving(false); setMotivo(""); setNotaArq(""); }), "Arquivada")}>Arquivar</button></div></div>
        ) : (<>
          {etapaIdx < ETAPAS_ATIVAS.length - 1 && <button className="btn primary lg" onClick={() => act(moveDeal(d, ETAPAS_ATIVAS[etapaIdx + 1].id, email), `Passou para ${ETAPAS_ATIVAS[etapaIdx + 1].nome}`)}>
            <Icon name="check" />Avançar para {ETAPAS_ATIVAS[etapaIdx + 1].nome}</button>}
          <button className="btn lg" onClick={() => setArchiving(true)}><Icon name="prohibit" />Arquivar</button><span className="sp" />
        </>)) : (<>
          <button className="btn lg" onClick={() => act(reopenDeal(d, email), "Reaberta")}><Icon name="arrow-u-up-left" />Reabrir</button><span className="sp" />
        </>)}
      </div>
    </aside>
    {analise && <AnaliseView alvo={alvoDeal(d)} onClose={() => setAnalise(false)} notify={notify} />}
  </>);
}
