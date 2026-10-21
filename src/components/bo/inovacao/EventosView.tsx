"use client";
import { useEffect, useMemo, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { CatSelect } from "@/components/CatSelect";
import { corDe, Evento, OBJETIVOS_EV, PAPEIS, TIPOS_EV, dataPt, eur, eventoVazio, eventosDoExcel, parceirosDe, proximaRef, type Projeto } from "@/lib/inovacao";
import { Empty, SearchField } from "../ui";
import { errMsg, useFlash } from "../admin/common";
import { useConfirm } from "../Confirm";
import { Detalhe, ImportarExcel, Kpis, opcoes, ordenar, Tag, th, useLive } from "./shared";
import { EventoFicha, EventoForm } from "./EventoFicha";

type Col = "ref" | "nome" | "inicio" | "tipo" | "papel" | "parceiro";
type F = { ano: string; tipo: string; objetivo: string; papel: string };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const anoDe = (e: Evento) => (e.inicio || "").slice(0, 4);
const ANO = String(new Date().getFullYear());
const F_DIA = new Intl.DateTimeFormat("pt-PT", { day: "numeric" }), F_MES = new Intl.DateTimeFormat("pt-PT", { month: "short" });
const dia = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const OPC_TIPO = opcoes(TIPOS_EV), OPC_OBJ = opcoes(OBJETIVOS_EV), OPC_PAPEL = opcoes(PAPEIS);

/** Eventos de Inovação: lista por ano, filtros, detalhe, criar, editar e apagar. */
export function EventosView() {
  const { list, loaded, erro } = useLive<Evento>("events");
  const { list: projetos } = useLive<Projeto>("projects");
  const { flash, el } = useFlash();
  const { confirmar, el: cfEl } = useConfirm();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>({ ano: ANO, tipo: "all", objetivo: "all", papel: "all" });
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "inicio", dir: -1 });
  const [aberto, setAberto] = useState<string | null>(null);
  // Vista em lista ou em cartões (lembrada neste browser)
  const [vista, setVistaS] = useState<"lista" | "cartoes">("lista");
  useEffect(() => { try { const v = localStorage.getItem("inv-ev-vista"); if (v === "lista" || v === "cartoes") setVistaS(v); } catch { /* sem armazenamento */ } }, []);
  const setVista = (v: "lista" | "cartoes") => { setVistaS(v); try { localStorage.setItem("inv-ev-vista", v); } catch { /* sem armazenamento */ } };
  const [ed, setEd] = useState<(Evento & { _novo?: boolean }) | null>(null);

  const parceiros = useMemo(() => parceirosDe([...projetos, ...list]), [projetos, list]);
  const anos = useMemo(() => opcoes([...new Set([ANO, ...list.map(anoDe).filter(Boolean)])].sort().reverse(), false), [list]);
  const passa = (e: Evento, sem?: keyof F) => (sem === "ano" || f.ano === "all" || anoDe(e) === f.ano) && (sem === "tipo" || f.tipo === "all" || e.tipo === f.tipo) &&
    (sem === "objetivo" || f.objetivo === "all" || e.objetivo === f.objetivo) && (sem === "papel" || f.papel === "all" || e.papel === f.papel) &&
    (!q.trim() || norm([e.ref, e.nome, e.parceiro, e.pais, e.observacoes].join(" ")).includes(norm(q.trim())));
  const conta = (k: keyof F, campo: (e: Evento) => boolean) => list.filter((e) => passa(e, k) && campo(e)).length;
  const filtrados = useMemo(() => list.filter((e) => passa(e)), [list, f, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => ordenar(filtrados, (e) => (e[sort.col] || "").toString().toLowerCase(), sort.dir), [filtrados, sort]);
  const soma = (k: "gasto" | "valorPatrocinio") => filtrados.reduce((t, e) => t + (e[k] || 0), 0);
  const atual = aberto ? list.find((e) => e.id === aberto) || null : null;

  const guardar = async () => {
    if (!ed) return;
    if (!ed.nome.trim()) { flash("Indica o nome do evento."); return; }
    if (!ed.inicio) { flash("Indica a data de início."); return; }
    const { id, _novo, ...x } = ed;
    const agora = new Date().toISOString();
    const parceiroRef = x.parceiro.trim() && !x.parceiroRef ? proximaRef("PA", [...projetos, ...list].map((y) => y.parceiroRef || "")) : x.parceiro.trim() ? x.parceiroRef : "";
    try {
      await setDoc(doc(db, "events", id), { ...x, fim: x.fim || x.inicio, parceiro: x.parceiro.trim(), parceiroRef, parceria: x.parceria || !!x.parceiro.trim(), atualizadoEm: agora, criadoEm: x.criadoEm || agora });
      setEd(null); setAberto(id); flash(_novo ? "Evento criado" : "Evento guardado");
    } catch (e) { flash(errMsg(e)); }
  };
  const apagar = async (e: Evento) => {
    if (!(await confirmar({ titulo: `Apagar o evento «${e.nome || "sem nome"}»?`, texto: "Não dá para anular.", ok: "Apagar", perigo: true }))) return;
    try { await deleteDoc(doc(db, "events", e.id)); setAberto(null); setEd(null); flash("Evento apagado"); } catch (er) { flash(errMsg(er)); }
  };
  const novo = () => { const ref = proximaRef("E", list.map((e) => e.ref || e.id)); setAberto(null); setEd({ ...eventoVazio(ref), _novo: true }); };

  /** Sair da edição: avisa se houver alterações por guardar. */
  const sair = async () => {
    if (!ed) return;
    const { _novo, ...x } = ed;
    const mudou = _novo ? !!x.nome.trim() : JSON.stringify(x) !== JSON.stringify(atual);
    if (mudou && !(await confirmar({ titulo: "Sair sem guardar?", texto: "As alterações que fizeste perdem-se.", ok: "Sair sem guardar", perigo: true }))) return;
    setEd(null);
  };
  const S = (k: Col, l: string, cls = "", desc = false) => th(sort, setSort, k, l, cls, desc);
  const set = (k: keyof F) => (v: string) => setF({ ...f, [k]: v });
  const det = ed || atual;
  const pagina = det && (<Detalhe voltar="Eventos" titulo={det.nome} editando={!!ed}
        tags={<>{det.tipo && <Tag v={det.tipo} />}{det.papel && <Tag v={det.papel} />}</>}
        onClose={() => { setEd(null); setAberto(null); }} onEditar={() => atual && setEd({ ...atual })} onCancelar={sair}
        onGuardar={guardar} onApagar={ed?._novo ? undefined : () => apagar(det)}
        leitura={<EventoFicha e={det} />}
        edicao={ed && <EventoForm ed={ed} setEd={(x) => setEd({ ...x, _novo: ed._novo })} parceiros={parceiros} />} />);
  if (det) return (<>
    {pagina}
    {cfEl}
    {el}
  </>);
  return (<>
    <div className="head">
      <div><h1>Eventos</h1><p>Eventos, sessões de scouting, formações e podcasts.</p></div>
      <div className="pageact">
        <SearchField value={q} onChange={setQ} placeholder="Pesquisar eventos" />
        {loaded && !erro && !list.length && <ImportarExcel folha="Fact_Events" col="events" conv={eventosDoExcel} nome="eventos" notify={flash} />}
        <button className="btn primary" onClick={novo} disabled={!!erro}><Icon name="plus" />Novo evento</button>
      </div>
    </div>
    {!loaded ? <div className="loading">A carregar…</div> : erro ? <Empty title="Sem acesso aos eventos" text={erro} /> : !list.length ? <Empty title="Ainda não há eventos" text="Cria o primeiro ou importa a folha «Fact_Events» do Excel de Inovação." /> : <>
      <Kpis itens={[
        { l: "Eventos", v: filtrados.length }, { l: "Como orador ou júri", v: filtrados.filter((e) => ["Speaker", "Jury", "Mentor", "Moderator"].includes(e.papel)).length },
        { l: "Organizados", v: filtrados.filter((e) => e.papel === "Organizer").length }, { l: "Com parceria", v: filtrados.filter((e) => e.parceria).length },
        { l: "Gasto", v: eur(soma("gasto")) || "0 €" }, { l: "Patrocínios", v: eur(soma("valorPatrocinio")) || "0 €" },
      ]} />
      <div className="toolbar">
        <CatSelect cats={anos} value={f.ano} onChange={set("ano")} simples counts={(a) => conta("ano", (e) => anoDe(e) === a)} allLabel="Todos os anos" procurar="Procurar ano" />
        <CatSelect cats={OPC_TIPO} value={f.tipo} onChange={set("tipo")} simples counts={(id) => conta("tipo", (e) => e.tipo === id)} allLabel="Todos os tipos" procurar="Procurar tipo" />
        <CatSelect cats={OPC_OBJ} value={f.objetivo} onChange={set("objetivo")} simples counts={(id) => conta("objetivo", (e) => e.objetivo === id)} allLabel="Todos os objetivos" procurar="Procurar objetivo" />
        <CatSelect cats={OPC_PAPEL} value={f.papel} onChange={set("papel")} simples counts={(id) => conta("papel", (e) => e.papel === id)} allLabel="Todos os papéis" procurar="Procurar papel" />
        <span className="sp" />
        <div className="seg" role="group" aria-label="Vista">
          <button aria-pressed={vista === "lista"} onClick={() => setVista("lista")}><Icon name="list-bullets" />Lista</button>
          <button aria-pressed={vista === "cartoes"} onClick={() => setVista("cartoes")}><Icon name="squares-four" />Cartões</button>
        </div>
      </div>
      {!rows.length ? <Empty title="Nada encontrado" text="Muda a pesquisa, o ano ou os filtros." /> : vista === "cartoes" ? (
        <ul className="ev-grid">{rows.map((e) => (
          <li key={e.id}>
            <button type="button" className="ev-card" onClick={() => setAberto(e.id)} style={{ ["--c" as string]: corDe(e.tipo) }}>
              <span className="ev-top">
                {e.inicio && <time dateTime={e.inicio} className="ev-d"><b>{F_DIA.format(dia(e.inicio))}</b><span>{F_MES.format(dia(e.inicio)).replace(".", "")}</span></time>}
                <span className="ev-h"><b>{e.nome}</b><small>{e.fim && e.fim !== e.inicio ? `${dataPt(e.inicio)} a ${dataPt(e.fim)}` : dataPt(e.inicio)}{e.pais && e.pais !== "Portugal" ? `, ${e.pais}` : ""}</small></span>
              </span>
              {e.objetivo && <span className="ev-obj">{e.objetivo}</span>}
              <span className="ev-tags">{e.tipo && <Tag v={e.tipo} />}{e.papel && <Tag v={e.papel} />}</span>
              <span className="ev-foot">{e.parceiro ? <span className="ev-par">{e.parceiro}</span> : <span className="mut">Sem parceiro</span>}<span className="sp" />
                {e.patrocinio && <span className="tg">Patrocínio{e.valorPatrocinio ? ` ${eur(e.valorPatrocinio)}` : ""}</span>}</span>
            </button>
          </li>))}</ul>
      ) : (
        <div className="tbl stbl ptbl inv-tbl">
          <table>
            <thead><tr>
              {S("nome", "Evento")}{S("inicio", "Data", "n", true)}{S("tipo", "Tipo")}{S("papel", "Papel")}{S("parceiro", "Parceiro")}
            </tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id} tabIndex={0} onClick={() => setAberto(e.id)} onKeyDown={(k) => { if (k.key === "Enter" && k.target === k.currentTarget) setAberto(e.id); }}>
                <td><b className="inv-n">{e.nome}</b><span className="mut sm">{[e.objetivo, e.pais !== "Portugal" ? e.pais : ""].filter(Boolean).join(" · ")}</span></td>
                <td className="n mut">{dataPt(e.inicio)}</td>
                <td>{e.tipo ? <Tag v={e.tipo} /> : <span className="mut">-</span>}</td>
                <td>{e.papel ? <Tag v={e.papel} /> : <span className="mut">-</span>}</td>
                <td>{e.parceiro || <span className="mut">-</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </>}
    {cfEl}
    {el}
  </>);
}
