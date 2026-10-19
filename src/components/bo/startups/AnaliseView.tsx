"use client";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { analiseMarkdown, elegibilidade, euros, nomeCiclo, nomeTicket, nomeVertical, PROCURA } from "@/lib/analise-util";
import { AlvoAnalise, AnaliseErro, loadAnalises, Parte, ParteId, Passos, runAnalise } from "@/lib/analise-run";
import { useAnaliseQueue } from "../AnaliseQueue";
import { Analise, CRITERIOS, GRUPOS_CRITERIOS, MATRIZ, TICKETS, VEREDICTOS, Veredicto } from "@/lib/types";
import { fdLongo } from "@/lib/util";
import { useSession } from "../AuthGate";
import { ACEITES, DocAnalise, lerDocumento, MAX_BINARIO } from "@/lib/doc-text";

const PASSOS: { id: ParteId | "avaliar"; nome: string; desc: string }[] = [
  { id: "empresa", nome: "Empresa e negócio", desc: "Produto, clientes, modelo de negócio, tração e tecnologia" },
  { id: "equipa", nome: "Equipa e financiamento", desc: "Fundadores, rondas, investidores e ronda atual" },
  { id: "avaliar", nome: "Avaliação", desc: "Os 11 critérios das guidelines, decisão, ticket e próximos passos" },
];
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function Verdict({ v, sm }: { v: Veredicto; sm?: boolean }) {
  return <span className={`vd vd-${v}${sm ? " sm" : ""}`}><Icon name={VEREDICTOS[v].icon} />{VEREDICTOS[v].nome}</span>;
}
function Campo({ k, v }: { k: string; v?: string }) {
  const vazio = !v || /^sem dados/i.test(v);
  return <div><dt>{k}</dt><dd className={vazio ? "vazio" : ""}>{v || "Sem dados públicos"}</dd></div>;
}

/** Análise de investimento com os critérios da Sogrape Ventures: perfil, avaliação, matriz por ticket e decisão. */
export function AnaliseView({ alvo, onClose, notify }: { alvo: AlvoAnalise; onClose: () => void; notify: (m: string) => void }) {
  const { email } = useSession();
  const { running } = useAnaliseQueue();
  const emFundo = running.has(alvo.path);
  const [hist, setHist] = useState<Analise[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [passos, setPassos] = useState<Passos | null>(null);
  const [partes, setPartes] = useState<Partial<Record<ParteId, Parte>>>({});
  const [erro, setErro] = useState("");
  const busy = !!passos && Object.values(passos).includes("a correr");
  // Documentos para juntar à análise (pergunta-se antes de fazer ou refazer)
  const [pedir, setPedir] = useState(false);
  const [docs, setDocs] = useState<DocAnalise[]>([]);
  const [lendo, setLendo] = useState(false);
  const [erroDoc, setErroDoc] = useState("");
  const juntar = async (fs: FileList | null) => {
    if (!fs?.length) return;
    setLendo(true); setErroDoc("");
    const novos: DocAnalise[] = [], erros: string[] = [];
    for (const f of Array.from(fs)) {
      try { novos.push(await lerDocumento(f)); } catch (e) { erros.push((e as Error).message); }
    }
    const todos = [...docs.filter((d) => !novos.some((n) => n.nome === d.nome)), ...novos].slice(0, 8);
    const bin = todos.filter((d) => d.base64).reduce((n, d) => n + (d.base64!.length * 3) / 4, 0);
    if (bin > MAX_BINARIO) erros.push("Os PDF e as imagens passam de 3 MB no total. Tira algum ou junta uma versão mais leve.");
    else setDocs(todos);
    setErroDoc(erros.join(" "));
    setLendo(false);
  };

  useEffect(() => { if (!emFundo) loadAnalises(alvo.path).then(setHist).catch(() => setHist([])); }, [alvo.path, emFundo]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); if (!busy) onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [busy, onClose]);

  const run = useCallback(async (jaTem: Partial<Record<ParteId, Parte>> = {}) => {
    setErro(""); setPedir(false);
    try {
      const r = await runAnalise(alvo, email, setPassos, jaTem, docs);
      setHist((h) => [r.analise, ...(h || [])]); setIdx(0); setPassos(null); setPartes({});
      notify(r.comGuidelines ? "Análise feita e guardada" : "Análise feita sem as guidelines completas. Cola-as em Definições › Startups › Critérios de investimento.");
    } catch (e) {
      setErro((e as Error).message);
      if (e instanceof AnaliseErro) setPartes(e.partes);
    }
  }, [alvo, email, notify, docs]);

  const a = hist?.[idx];
  const copiar = async () => {
    if (!a) return;
    try { await navigator.clipboard.writeText(analiseMarkdown({ nome: alvo.nome, site: alvo.site }, a)); notify("Relatório copiado em Markdown"); } catch { notify("Não foi possível copiar."); }
  };

  return (<>
    <div className="scrim top" onClick={() => !busy && onClose()} />
    <div className="mdl xl" role="dialog" aria-modal="true" aria-labelledby="an-t">
      <div className="mdl-h">
        <div><h2 id="an-t">Análise de investimento</h2><span className="mdl-sub">{alvo.nome}{alvo.dominio ? ` · ${alvo.dominio}` : ""}</span></div>
        <button className="btn icon" aria-label="Fechar" onClick={onClose} disabled={busy}><Icon name="x" /></button>
      </div>

      <div className="mdl-b scroll an">
        {emFundo && <div className="an-intro"><span className="spin" aria-hidden="true" /><div><b>A análise está a correr em segundo plano</b><p>Começou quando a startup foi adicionada. Avisamos quando estiver pronta; podes fechar esta janela.</p></div></div>}
        {!emFundo && hist === null && <div className="loading">A carregar…</div>}

        {!emFundo && hist !== null && (passos || !a) && (
          <div className="an-run">
            {!passos && <>
              <div className="an-intro"><Icon name="scales" size={22} />
                <div><b>Avaliar com os critérios da Sogrape Ventures</b>
                  <p>A Gemini pesquisa a startup na web (empresa, equipa e financiamento), avalia os 11 critérios das guidelines de 2026, monta a matriz por ticket e propõe decisão, ticket, follow-on e próximos passos. Demora cerca de 1 minuto. Cada análise fica guardada com data, e podes refazê-la quando houver informação nova.</p></div></div>
            </>}
            {passos && <ol className="an-steps">
              {PASSOS.map((p) => {
                const v = passos[p.id];
                return <li key={p.id} className={`st-${v.replace(" ", "-")}`}>
                  <span className="dot">{v === "a correr" ? <span className="spin" aria-hidden="true" /> : v === "ok" ? <Icon name="check" /> : v === "erro" ? <Icon name="x" /> : null}</span>
                  <div><b>{p.nome}</b><span>{p.desc}</span></div>
                </li>;
              })}
            </ol>}
            {erro && <p className="gerr" role="alert">{erro}</p>}
          </div>
        )}

        {!emFundo && hist !== null && !passos && (pedir || !a) && (
          <div className="an-docs">
            <div className="an-docs-h"><Icon name="stack" size={20} /><div><b>Queres juntar documentos à análise?</b>
              <p>Deck, business plan, financeiras ou outro material da startup. A Gemini usa-os como evidência além da informação pública. Podes juntar até 8 (PDF, Word, PowerPoint, Excel, texto ou imagem; PDF e imagens até 3 MB no total). Não ficam guardados, só os nomes.</p></div></div>
            <label className="impf">
              <input type="file" multiple accept={ACEITES} onChange={(e) => { juntar(e.target.files); e.target.value = ""; }} disabled={lendo} />
              <Icon name="plus" /><span>{lendo ? "A ler os documentos…" : docs.length ? "Juntar mais documentos" : "Escolher documentos"}</span>
            </label>
            {docs.length > 0 && <ul className="an-dl">{docs.map((d) => (
              <li key={d.nome}><Icon name="stack" size={14} /><span>{d.nome}</span><em>{d.base64 ? `${Math.round((d.base64.length * 3) / 4 / 1024)} KB` : ((d.texto || "").length < 1000 ? `${(d.texto || "").length} caracteres` : `${Math.round((d.texto || "").length / 1000)} mil caracteres`)}</em>
                <button type="button" className="btn icon" aria-label={`Tirar ${d.nome}`} onClick={() => setDocs(docs.filter((x) => x.nome !== d.nome))}><Icon name="x" /></button></li>))}</ul>}
            {erroDoc && <p className="gerr" role="alert">{erroDoc}</p>}
          </div>
        )}
        {a && !passos && !pedir && <AnaliseReport a={a} />}
      </div>

      <div className="mdl-f">
        {a && !passos && !pedir && <>
          <span className="an-meta">{fdLongo(a.feitaEm)}{a.por ? ` · ${a.por === "recolha" ? "recolha semanal" : a.por}` : ""}</span>
          {hist && hist.length > 1 && <select className="an-hist" value={idx} onChange={(e) => setIdx(+e.target.value)} aria-label="Análises anteriores">
            {hist.map((h, i) => <option key={h.id || i} value={i}>{i === 0 ? "Mais recente" : fdLongo(h.feitaEm)}</option>)}</select>}
        </>}
        <span className="sp" />
        {a && !passos && !pedir && <button className="btn" onClick={copiar}><Icon name="copy" />Copiar relatório</button>}
        {passos && erro && !busy && <button className="txtbtn" onClick={() => { setPassos(null); setErro(""); setPartes({}); }}>Cancelar</button>}
        {busy ? <button className="btn primary" disabled><span className="spin" aria-hidden="true" />A analisar…</button>
          : passos && erro ? <button className="btn primary" onClick={() => run(partes)}><Icon name="arrows-clockwise" />Tentar outra vez</button>
          : !emFundo && hist !== null && (pedir || !a)
            ? <>{pedir && <button className="txtbtn" onClick={() => { setPedir(false); setErroDoc(""); }}>Cancelar</button>}
              <button className="btn primary" onClick={() => run()} disabled={lendo}><Icon name={a ? "arrows-clockwise" : "sparkle"} />{docs.length ? `${a ? "Refazer" : "Fazer"} análise com ${docs.length} ${docs.length === 1 ? "documento" : "documentos"}` : `${a ? "Refazer" : "Fazer"} análise sem documentos`}</button></>
          : !emFundo && hist !== null && <button className="btn" onClick={() => setPedir(true)}><Icon name="arrows-clockwise" />Refazer análise</button>}
      </div>
    </div>
  </>);
}

/** O relatório de uma análise (só apresentação). */
export function AnaliseReport({ a }: { a: Analise }) {
  return (<>
          {/* Decisão */}
          <section className={`an-hero ${a.decisao}`}>
            <div className="an-top">
              <div className="an-dec"><span className="lbl">Decisão</span><b>{a.decisao === "investir" ? "Investir" : "Não investir"}</b></div>
              <dl className="an-kpis">
                <div><dt>Ticket</dt><dd>{nomeTicket(a.ticket)}</dd></div>
                <div><dt>Follow-on</dt><dd>{a.followOn ? "Sim" : "Não"}</dd></div>
                <div><dt>Critérios positivos</dt><dd>{a.criterios.filter((c) => c.veredicto === "positivo").length} de {a.criterios.length}</dd></div>
                <div className="wide"><dt>Desafio 2026</dt><dd className="dz">{a.desafio || "Nenhum"}</dd></div>
              </dl>
            </div>
            {a.condicoes && <div className="an-cond"><span className="lbl">Condições</span><p>{a.condicoes}</p></div>}
            <p className="an-rac">{a.racional}</p>
          </section>

          {/* Matriz */}
          <details className="an-sec an-mxd">
            <summary>
              <span className="t"><Icon name="caret-down" />Matriz por ticket</span>
              <span className="els">{elegibilidade(a).map((e, i) => <span key={i} className={`el el-${e}`}>{TICKETS[i].nome}: {({ sim: "cumpre", dados: "faltam dados", nao: "não cumpre" })[e]}</span>)}</span>
              <span className="ver">Ver matriz</span>
            </summary>
            <p className="hint">Como nas guidelines: a cor mostra o veredicto de cada critério nos tickets em que conta. Os tickets até 200 mil € pedem a maioria; acima, todos.</p>
            <div className="an-mx-wrap"><table className="an-mx">
              <thead><tr><th>Critério</th>{TICKETS.map((t) => <th key={t.id} className={a.ticket === t.id ? "on" : ""}>{t.nome}</th>)}</tr></thead>
              <tbody>
                {MATRIZ.map((m) => {
                  const v = a.criterios.find((c) => c.id === m.criterio)?.veredicto || "incerto";
                  return <tr key={m.criterio}><th>{m.nome}</th>{m.peso.map((w, i) => (
                    <td key={i} className={w ? `mx-${v} w${w}` : "mx-0"} title={w ? `${VEREDICTOS[v].nome}${w === 2 ? " (obrigatório)" : ""}` : "Não conta neste ticket"}>{w ? <><Icon name={VEREDICTOS[v].icon} /><span className="sr">{VEREDICTOS[v].nome}{w === 2 ? ", obrigatório" : ""}</span></> : <span className="sr">Não conta</span>}</td>
                  ))}</tr>;
                })}
              </tbody>
              <tfoot><tr><th>Cumpre?</th>{elegibilidade(a).map((e, i) => <td key={i} className={`el-${e}`}>{({ sim: "Sim", dados: "Faltam dados", nao: "Não" })[e]}</td>)}</tr></tfoot>
            </table></div>
            <div className="an-leg"><span className="mx-positivo" />Positivo<span className="mx-incerto" />Incerto<span className="mx-negativo" />Negativo<span className="mx-0" />Não conta</div>
          </details>

          {/* Perfil */}
          <section className="an-sec">
            <h3>Perfil</h3>
            <p className="an-lead">{a.perfil.resumo}</p>
            <div className="an-grid">
              <div className="an-card"><h4>Identificação</h4><dl className="an-dl">
                <Campo k="Vertical" v={nomeVertical(a.perfil.vertical)} /><Campo k="Ciclo de vida" v={nomeCiclo(a.perfil.ciclo)} />
                <Campo k="Fundação" v={a.perfil.fundacao} /><Campo k="Sede" v={a.perfil.sede} /><Campo k="Mercados" v={a.perfil.mercados} />
              </dl></div>
              <div className="an-card"><h4>Financiamento</h4><dl className="an-dl">
                <Campo k="Total levantado" v={euros(a.perfil.financiamento.totalEur)} />
                <Campo k="À procura de financiamento" v={PROCURA[a.perfil.financiamento.procura]} />
                <Campo k="Ronda atual" v={euros(a.perfil.financiamento.rondaAtualEur)} />
                <Campo k="Rondas" v={a.perfil.financiamento.rondas.join("; ")} />
                <Campo k="Investidores" v={a.perfil.financiamento.investidores.join(", ")} />
              </dl></div>
              <div className="an-card wide"><h4>Produto e negócio</h4><dl className="an-dl">
                <Campo k="Produto" v={a.perfil.produto} /><Campo k="Clientes-alvo" v={a.perfil.clientesAlvo} />
                <Campo k="Modelo de negócio" v={a.perfil.modeloNegocio} /><Campo k="Tecnologia" v={a.perfil.tecnologia} />
                <Campo k="Cadeia de valor do vinho" v={a.perfil.cadeiaValor} />
              </dl></div>
              <div className="an-card"><h4>Tração</h4><dl className="an-dl">
                <Campo k="Receita" v={a.perfil.tracao.receita} /><Campo k="Clientes" v={a.perfil.tracao.clientes} /><Campo k="Pilotos" v={a.perfil.tracao.pilotos} />
              </dl></div>
              <div className="an-card"><h4>Equipa</h4>
                {a.perfil.equipa.length ? <ul className="an-team">{a.perfil.equipa.map((p) => <li key={p.nome}><b>{p.nome}</b><span className="cg">{p.cargo}</span><span>{p.percurso}</span></li>)}</ul>
                  : <p className="vazio">Sem dados públicos sobre a equipa.</p>}
              </div>
            </div>
          </section>

          {/* Avaliação */}
          <section className="an-sec">
            <h3>Avaliação</h3>
            {GRUPOS_CRITERIOS.map((g) => (
              <div key={g.id} className="an-grp">
                <h4>{g.nome}<span>{g.desc}</span></h4>
                {CRITERIOS.filter((c) => c.grupo === g.id).map((c) => {
                  const r = a.criterios.find((x) => x.id === c.id);
                  return <div key={c.id} className="an-crit">
                    <div className="ch"><b>{c.nome}</b><Verdict v={r?.veredicto || "incerto"} sm /></div>
                    <p>{r?.justificacao}</p>
                    {!!r?.fontes.length && <div className="an-src">{r.fontes.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">{host(u)}<Icon name="arrow-up-right" size={12} /></a>)}</div>}
                  </div>;
                })}
              </div>
            ))}
          </section>

          {/* Resumo */}
          <section className="an-sec">
            <h3>Resumo</h3>
            <div className="an-3">
              <div className="an-card ok"><h4>Forças</h4><ul>{a.forcas.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div className="an-card no"><h4>Riscos</h4><ul>{a.riscos.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div className="an-card wa"><h4>Informação em falta</h4><ul>{a.emFalta.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
          </section>

          <section className="an-sec">
            <div className="an-grid">
              <div className="an-card"><h4>Ticket: {nomeTicket(a.ticket)}</h4><p>{a.ticketRacional}</p></div>
              <div className="an-card"><h4>Follow-on: {a.followOn ? "Sim" : "Não"}</h4><p>{a.followOnRacional}</p></div>
              <div className="an-card wide"><h4>Encaixe no portefólio</h4><p>{a.encaixe}</p></div>
              <div className="an-card wide"><h4>Próximos passos</h4><ol>{a.proximosPassos.map((x) => <li key={x}>{x}</li>)}</ol></div>
            </div>
          </section>

          {!!a.documentos?.length && <section className="an-sec">
            <h3>Documentos juntados</h3>
            <ul className="an-dl">{a.documentos.map((d) => <li key={d}><Icon name="stack" size={14} /><span>{d}</span></li>)}</ul>
          </section>}
          {a.fontes.length > 0 && <section className="an-sec">
            <h3>Fontes</h3>
            <ul className="an-fontes">{a.fontes.map((f) => <li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer"><span>{f.titulo}</span><em>{host(f.url)}</em><Icon name="arrow-up-right" size={12} /></a></li>)}</ul>
          </section>}
          <p className="an-disc">Gerada pela Gemini a partir de informação pública, com as guidelines de investimento da Sogrape Ventures. É um ponto de partida para a diligence, não substitui a decisão do comité.</p>
  </>);
}
