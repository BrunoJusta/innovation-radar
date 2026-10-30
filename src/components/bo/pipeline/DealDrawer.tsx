"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { nomeTicket } from "@/lib/analise-util";
import { addInteracao, archiveDeal, dealParaAprovadas, delInteracao, moveDeal, reopenDeal, saveDeal } from "@/lib/deal-actions";
import { AlvoAnalise } from "@/lib/analise-run";
import { Deal, ETAPAS, ETAPAS_ATIVAS, Etapa, emCurso, FASES_DF, Interacao, MOTIVOS_ARQUIVO, MotivoArquivo, ORIGENS_DF, TIPOS_INTERACAO, TipoInteracao, VERTICAIS_DF, nomeDecisao } from "@/lib/types";
import { fdLongo, hojeLocal, nDias } from "@/lib/util";
import { useSession } from "../AuthGate";
import { AnaliseView } from "../startups/AnaliseView";
import { DealEdit, DealFields, fmtEur, pickDeal } from "./DealFields";
import { LogoEditor } from "../startups/Logo";
import { useConfirm } from "../Confirm";
import { aplicarNome, planoNome, textoPlano } from "@/lib/startup-actions";
import { AREAS_LISTA } from "@/lib/taxonomia";
import { useAreas, useCategorias } from "@/lib/use-areas";
import { diasDesde } from "./PipelineBoard";
import { PassosBox } from "./PassosBox";

const nm = <T extends { id: string; nome: string }>(l: T[], id: string | null | undefined) => l.find((x) => x.id === id)?.nome || "";
const hoje = () => hojeLocal();

export const alvoDeal = (d: Deal): AlvoAnalise => d.startupId
  ? { path: `startups/${d.startupId}`, alsoResumo: `deals/${d.id}`, nome: d.nome, site: d.site, dominio: d.dominio, descricao: d.descricao, setor: AREAS_LISTA.find((a) => a.id === d.cadeia)?.nome || "", logo: d.logo }
  : { path: `deals/${d.id}`, nome: d.nome, site: d.site, dominio: d.dominio, descricao: d.descricao, setor: AREAS_LISTA.find((a) => a.id === d.cadeia)?.nome || "", logo: d.logo };

/** Ficha de uma startup no pipeline: fase, próximo passo, análise, ficha, ronda e cronologia. */
export function DealDrawer({ d, list, origens, pessoas, onClose, onNav, notify }: {
  d: Deal; list: Deal[]; origens: string[]; pessoas: string[]; onClose: () => void; onNav: (id: string) => void; notify: (m: string) => void;
}) {
  const { email } = useSession();
  const { confirmar, el: cfEl } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<DealEdit>(pickDeal(d));
  const [archiving, setArchiving] = useState(false);
  const cad = useAreas().find((a) => a.id === d.cadeia), cat = useCategorias().find((c) => c.id === d.categoria);
  const [motivo, setMotivo] = useState<MotivoArquivo | "">("");
  const [notaArq, setNotaArq] = useState("");
  // Editar o motivo de uma startup já arquivada
  const [editArq, setEditArq] = useState<NonNullable<Deal["arquivo"]> | null>(null);
  const guardarArq = () => {
    if (!editArq) return;
    const a = { ...editArq, nota: editArq.nota.trim() };
    act(saveDeal(d, { arquivo: a }).then(() => addInteracao(d.id, { data: hojeLocal(), tipo: "nota", texto: `Motivo de arquivo alterado: ${nm(MOTIVOS_ARQUIVO, a.motivo)}${a.nota ? `. ${a.nota}` : ""}`, por: email })).then(() => setEditArq(null)), "Motivo de arquivo guardado");
  };
  // Corrigir a data de entrada nas investidas (a data de investimento) ou no radar
  const [editDesde, setEditDesde] = useState<string | null>(null);
  const guardarDesde = () => {
    if (!editDesde || editDesde === d.etapaDesde) { setEditDesde(null); return; }
    const o = d.etapa === "investida" ? "Data de investimento" : "Data de entrada no radar";
    act(saveDeal(d, { etapaDesde: editDesde }).then(() => addInteracao(d.id, { data: hojeLocal(), tipo: "nota", texto: `${o} corrigida: ${d.etapaDesde ? `${fdLongo(d.etapaDesde)} → ` : ""}${fdLongo(editDesde)}`, por: email })).then(() => setEditDesde(null)), `${o} guardada`);
  };
  const [analise, setAnalise] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ints, setInts] = useState<Interacao[] | null>(null);
  const [nova, setNova] = useState<{ tipo: TipoInteracao; data: string; texto: string; participantes: string; links: { titulo: string; url: string }[] } | null>(null);

  useEffect(() => { setEditing(false); setArchiving(false); setEditArq(null); setEditDesde(null); setNova(null); setF(pickDeal(d)); }, [d.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onSnapshot(query(collection(db, "deals", d.id, "interacoes"), orderBy("data", "desc")),
    (s) => setInts(s.docs.map((x) => ({ id: x.id, ...x.data() }) as Interacao)), () => setInts([])), [d.id]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !analise) { if (editDesde !== null) setEditDesde(null); else if (editing) setEditing(false); else if (archiving) setArchiving(false); else if (nova) setNova(null); else onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [editing, archiving, nova, analise, editDesde, onClose]);

  const i = list.findIndex((x) => x.id === d.id);
  /** Tira a startup do pipeline e põe-na nas Aprovadas (com confirmação: o deal e a cronologia são apagados). */
  const paraAprovadas = async () => {
    if (!(await confirmar({ titulo: `Mandar «${d.nome}» para as Aprovadas?`, texto: "Sai do pipeline e volta à lista de Aprovadas. Os próximos passos em aberto ficam em espera na ficha da startup e voltam a ficar ativos se ela regressar ao pipeline. A ficha da startup e a análise ficam; a cronologia e os dados da ronda do pipeline são apagados. Não dá para anular.", ok: "Mandar para as Aprovadas", perigo: true }))) return;
    act(dealParaAprovadas(d, email).then(() => onClose()), `«${d.nome}» passou para as Aprovadas`);
  };
  const act = (p: Promise<unknown>, msg: string) => p.then(() => notify(msg)).catch((e) => notify((e as { code?: string }).code === "permission-denied" ? "Sem permissão para alterar o pipeline." : "Não foi possível guardar. Tenta outra vez."));
  const saveFicha = async () => {
    const novo = f.nome.trim();
    if (!novo) return;
    const dominio = (f.site || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    if (novo === d.nome.trim()) { act(saveDeal(d, { ...f, dominio }).then(() => setEditing(false)), "Ficha guardada"); return; }
    // Mudou de nome: pede validação e muda o nome em todo o lado (radar de startups, projetos e eventos)
    const plano = await planoNome({ startupId: d.startupId, dealId: d.id }, d.nome, novo).catch(() => null);
    if (!plano) { notify("Não foi possível guardar. Tenta outra vez."); return; }
    if (!(await confirmar({ titulo: `Mudar o nome de «${d.nome}» para «${novo}»?`, texto: textoPlano(plano), ok: "Mudar o nome" }))) return;
    act(saveDeal(d, { ...f, nome: d.nome, dominio }).then(() => aplicarNome(plano, email)).then(() => setEditing(false)), `«${d.nome}» passou a chamar-se «${novo}»`);
  };
  const ativa = emCurso(d.etapa);
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
        <button className="btn icon" title="Anterior" aria-label="Anterior" disabled={i <= 0} onClick={() => onNav(list[i - 1].id)}><Icon name="caret-up" /></button>
        <button className="btn icon" title="Seguinte" aria-label="Seguinte" disabled={i < 0 || i >= list.length - 1} onClick={() => onNav(list[i + 1].id)}><Icon name="caret-down" /></button>
        <button className="btn icon" title="Fechar" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button></div>
      <div className="dscroll">
        <div className="dmeta">
          {d.ref && <span className="tg mn">{d.ref}</span>}
          {cad && <span className="tg"><i className="cdot" style={{ background: cad.cor }} />{cad.nome}</span>}
          {cat && <span className="tg">{cat.nome}</span>}
          {d.fase && <span className="tg">{nm(FASES_DF, d.fase)}</span>}
          {d.pais && <span className="tg">{d.pais}</span>}
          {d.interesse === "outro" && <span className="tg">Outra relação</span>}
          {d.startupId && <span className="badge"><Icon name="globe" />No radar de startups</span>}
        </div>
        <LogoEditor nome={d.nome} logo={d.logo} site={d.site} alvo={{ dealId: d.id, startupId: d.startupId }} notify={notify} />
        <h2>{d.nome}</h2>
        {!!d.nomesAnteriores?.length && <p className="relnote">Antes: {d.nomesAnteriores.join(", ")}</p>}
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
        ) : d.etapa !== "arquivada" ? (
          <div className={`fimbox f-${d.etapa}`}><Icon name={d.etapa === "investida" ? "check-circle" : "globe"} />
            {editDesde !== null ? (
              <div className="fimed">
                <label className="fld"><span>{d.etapa === "investida" ? "Data de investimento" : "No radar desde"}</span>
                  <input type="date" autoFocus value={editDesde} max="2100-12-31" onChange={(e) => setEditDesde(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") guardarDesde(); if (e.key === "Escape") { e.stopPropagation(); setEditDesde(null); } }} /></label>
                <div className="arqf"><button className="txtbtn" onClick={() => setEditDesde(null)}>Cancelar</button><span className="sp" />
                  <button className="btn primary" onClick={guardarDesde} disabled={!editDesde}><Icon name="check" />Guardar</button></div>
              </div>
            ) : (<>
              <div><b>{d.etapa === "investida" ? "Investida" : "No radar"}{d.etapaDesde ? ` desde ${fdLongo(d.etapaDesde)}` : ""}</b>
                {d.etapaAnterior && <span>Saiu de {nm(ETAPAS, d.etapaAnterior)}</span>}</div>
              <button className="txtbtn arqe" title={d.etapa === "investida" ? "Corrigir a data de investimento" : "Corrigir a data de entrada no radar"}
                onClick={() => setEditDesde(d.etapaDesde || hojeLocal())}><Icon name="pencil-simple" />Editar data</button>
            </>)}</div>
        ) : (
          editArq ? (
            <div className="reasons arqed">
              <div className="rh">Motivo de arquivo<button className="txtbtn" onClick={() => setEditArq(null)}>Cancelar</button></div>
              <div className="rgrid">{MOTIVOS_ARQUIVO.map((m) => <button key={m.id} aria-pressed={editArq.motivo === m.id} onClick={() => setEditArq({ ...editArq, motivo: m.id })}>{m.nome}</button>)}</div>
              <label className="fld"><span>Nota</span><textarea rows={3} value={editArq.nota} onChange={(e) => setEditArq({ ...editArq, nota: e.target.value })} placeholder="O que foi comunicado à startup" /></label>
              <div className="fgrid">
                <label className="fld"><span>Arquivada em</span><input type="date" value={editArq.em || ""} onChange={(e) => setEditArq({ ...editArq, em: e.target.value })} /></label>
                <label className="fld"><span>Estava em</span><select value={editArq.etapaAnterior || ""} onChange={(e) => setEditArq({ ...editArq, etapaAnterior: (e.target.value || null) as Etapa | null })}>
                  <option value="">Sem registo</option>{ETAPAS_ATIVAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
              </div>
              <div className="arqf"><span className="sp" /><button className="btn primary" onClick={guardarArq}><Icon name="check" />Guardar</button></div>
            </div>
          ) : (
          <div className="arqbox"><Icon name="prohibit" />
            <div><b>Arquivada{d.arquivo?.em ? ` em ${fdLongo(d.arquivo.em)}` : ""}: {nm(MOTIVOS_ARQUIVO, d.arquivo?.motivo)}</b>
              {d.arquivo?.nota && <p>{d.arquivo.nota}</p>}
              {d.arquivo?.etapaAnterior && <span>Estava em {nm(ETAPAS, d.arquivo.etapaAnterior)}</span>}</div>
            <button className="txtbtn arqe" onClick={() => setEditArq({ motivo: d.arquivo?.motivo || "sem-registo", nota: d.arquivo?.nota || "", em: d.arquivo?.em || hojeLocal(), etapaAnterior: d.arquivo?.etapaAnterior || null })}><Icon name="pencil-simple" />Editar</button></div>
          )
        )}
        <p className="since">{ativa ? `Em ${nm(ETAPAS, d.etapa)} há ${nDias(diasDesde(d.etapaDesde))} · ` : ""}Entrou em {fdLongo(d.entrada)}</p>

        {/* Próximos passos */}
        {ativa && <PassosBox d={d} pessoas={pessoas} by={email} act={act} />}

        {/* Análise */}
        <div className="blk"><div className="bh"><h4>Análise de investimento</h4></div>
          {d.analiseResumo ? (
            <button className={`anbox ${d.analiseResumo.decisao}`} onClick={() => setAnalise(true)}>
              <span className="d">{nomeDecisao(d.analiseResumo.decisao)}</span>
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
        <div className="blk"><div className="bh"><h4>Cronologia</h4>{!nova && <button className="txtbtn" onClick={() => setNova({ tipo: "reuniao", data: hoje(), texto: "", participantes: "", links: [] })}><Icon name="plus" />Registar</button>}</div>
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
              <div className="fld full"><span>Links <em>(opcional: deck, ata, email, pasta partilhada…)</em></span>
                <div className="docs-ed">
                  {nova.links.map((l, i) => (
                    <div key={i} className="doc-row">
                      <input aria-label={`Título do link ${i + 1}`} value={l.titulo} placeholder="Título (opcional)" onChange={(e) => setNova({ ...nova, links: nova.links.map((x, k) => k === i ? { ...x, titulo: e.target.value } : x) })} />
                      <input aria-label={`Endereço do link ${i + 1}`} value={l.url} type="url" spellCheck={false} placeholder="https://" onChange={(e) => setNova({ ...nova, links: nova.links.map((x, k) => k === i ? { ...x, url: e.target.value } : x) })} />
                      <button type="button" className="btn icon" aria-label="Tirar link" onClick={() => setNova({ ...nova, links: nova.links.filter((_, k) => k !== i) })}><Icon name="trash" /></button>
                    </div>
                  ))}
                  <button type="button" className="txtbtn" onClick={() => setNova({ ...nova, links: [...nova.links, { titulo: "", url: "" }] })}><Icon name="plus" />Juntar link</button>
                </div></div>
              <div className="factions"><button className="txtbtn" onClick={() => setNova(null)}>Cancelar</button>
                <button className="btn primary" disabled={!nova.texto.trim() || saving} onClick={() => { setSaving(true); const links = nova.links.map((l) => ({ titulo: l.titulo.trim(), url: /^https?:\/\//i.test(l.url.trim()) ? l.url.trim() : l.url.trim() ? `https://${l.url.trim()}` : "" })).filter((l) => l.url);
                  act(addInteracao(d.id, { tipo: nova.tipo, data: nova.data, texto: nova.texto.trim(), participantes: nova.participantes.trim() || undefined, ...(links.length ? { links } : {}), por: email })
                  .then(() => saveDeal(d, {})).then(() => setNova(null)), "Registado na cronologia").finally(() => setSaving(false)); }}><Icon name="check" />Registar</button></div>
            </div>
          )}
          {ints === null ? <p className="hint">A carregar…</p> : ints.length === 0 && !nova ? <p className="hint">Ainda não há nada registado. Regista reuniões, emails, documentos recebidos e o feedback da Beta Capital.</p> : (
            <ol className="tl">{grupos.map(([mes, xs]) => (
              <li key={mes} className="tlm"><span className="tlh">{mes ? new Date(mes + "-15T12:00:00").toLocaleDateString("pt-PT", { month: "long", year: "numeric" }) : "Sem data"}</span>
                <ol>{xs.map((x) => {
                  const t = TIPOS_INTERACAO.find((k) => k.id === x.tipo);
                  return <li key={x.id} className={`tli t-${x.tipo}`}>
                    <span className="tld"><Icon name={t?.icon || "pencil-simple"} /></span>
                    <div className="tlb"><div className="tlt"><b>{t?.nome}</b><span>{x.data ? fdLongo(x.data) : ""}{x.participantes ? ` · ${x.participantes}` : ""}{x.por ? ` · ${x.por === "Excel" ? "importado do Excel" : x.por.split("@")[0]}` : ""}</span>
                      <button className="tlx" title="Apagar" aria-label="Apagar registo" onClick={async () => { if (await confirmar({ titulo: "Apagar este registo da cronologia?", texto: x.tipo === "etapa" ? "É um registo de mudança de fase. A fase atual da startup não muda. Não dá para anular." : "Não dá para anular.", ok: "Apagar", perigo: true })) act(delInteracao(d.id, x.id), "Registo apagado"); }}><Icon name="trash" /></button></div>
                      <p>{x.texto}</p>
                      {!!x.links?.length && <div className="tll">{x.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"><Icon name="arrow-up-right" size={12} />{l.titulo || l.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}</a>)}</div>}</div>
                  </li>;
                })}</ol></li>
            ))}</ol>
          )}
        </div>
      </div>
      <div className="dbar">
        {ativa || (archiving && d.etapa !== "arquivada") ? (archiving ? (
          <div className="reasons"><div className="rh">Porque arquivas?<button className="txtbtn" onClick={() => setArchiving(false)}>Cancelar</button></div>
            <div className="rgrid">{MOTIVOS_ARQUIVO.filter((m) => m.id !== "sem-registo").map((m) => <button key={m.id} aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)}>{m.nome}</button>)}</div>
            <div className="arqf"><input aria-label="Nota de arquivo" value={notaArq} onChange={(e) => setNotaArq(e.target.value)} placeholder="Nota (opcional): o que foi comunicado à startup" />
              <button className="btn primary" disabled={!motivo} onClick={() => motivo && act(archiveDeal(d, motivo, notaArq.trim(), email).then(() => { setArchiving(false); setMotivo(""); setNotaArq(""); }), "Arquivada")}>Arquivar</button></div></div>
        ) : (<>
          {etapaIdx < ETAPAS_ATIVAS.length - 1 ? <button className="btn primary lg" onClick={() => act(moveDeal(d, ETAPAS_ATIVAS[etapaIdx + 1].id, email), `Passou para ${ETAPAS_ATIVAS[etapaIdx + 1].nome}`)}>
            <Icon name="check" />Avançar para {ETAPAS_ATIVAS[etapaIdx + 1].nome}</button>
            : <button className="btn primary lg" onClick={() => act(moveDeal(d, "investida", email), "Passou para as investidas")}><Icon name="check-circle" />Marcar como investida</button>}
          <button className="btn lg" onClick={() => act(moveDeal(d, "radar", email), "Passou para o radar")}><Icon name="globe" />Pôr no radar</button>
          <button className="btn lg" onClick={() => setArchiving(true)}><Icon name="prohibit" />Arquivar</button>
          <button className="btn lg" onClick={paraAprovadas} title="Tirar do pipeline e pôr nas Aprovadas"><Icon name="arrow-counter-clockwise" />Para as Aprovadas</button><span className="sp" />
        </>)) : (<>
          <button className="btn lg" onClick={() => act(reopenDeal(d, email), "Reaberta")}><Icon name="arrow-u-up-left" />Voltar ao pipeline</button>
          {d.etapa === "radar" && <button className="btn lg" onClick={() => act(moveDeal(d, "investida", email), "Passou para as investidas")}><Icon name="check-circle" />Investida</button>}
          {d.etapa !== "arquivada" && (archiving ? null : <button className="btn lg" onClick={() => setArchiving(true)}><Icon name="prohibit" />Arquivar</button>)}
          <button className="btn lg" onClick={paraAprovadas} title="Tirar do pipeline e pôr nas Aprovadas"><Icon name="arrow-counter-clockwise" />Para as Aprovadas</button>
          <span className="sp" />
        </>)}
      </div>
    </aside>
    {cfEl}
    {analise && <AnaliseView alvo={alvoDeal(d)} onClose={() => setAnalise(false)} notify={notify} />}
  </>);
}
