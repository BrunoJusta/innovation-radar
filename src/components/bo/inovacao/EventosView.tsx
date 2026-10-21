"use client";
import { useMemo, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { CatSelect } from "@/components/CatSelect";
import { AMBITOS, Evento, OBJETIVOS_EV, PAPEIS, TIPOS_EV, dataPt, eur, eventoVazio, eventosDoExcel, parceirosDe, proximaRef, type Projeto } from "@/lib/inovacao";
import { Empty, SearchField } from "../ui";
import { errMsg, useFlash } from "../admin/common";
import { useConfirm } from "../Confirm";
import { Dados, Detalhe, Eur, ImportarExcel, Kpis, opcoes, ordenar, Parceiro, Sel, SimNao, Tag, th, useLive } from "./shared";

type Col = "ref" | "nome" | "inicio" | "tipo" | "papel" | "parceiro";
type F = { ano: string; tipo: string; objetivo: string; papel: string };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const anoDe = (e: Evento) => (e.inicio || "").slice(0, 4);
const ANO = String(new Date().getFullYear());
const OPC_TIPO = opcoes(TIPOS_EV), OPC_OBJ = opcoes(OBJETIVOS_EV), OPC_PAPEL = opcoes(PAPEIS);
const datas = (e: Evento) => e.fim && e.fim !== e.inicio ? `${dataPt(e.inicio)} a ${dataPt(e.fim)}` : dataPt(e.inicio);

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
      setEd(null); setAberto(id); flash(_novo ? `Evento ${id} criado` : "Evento guardado");
    } catch (e) { flash(errMsg(e)); }
  };
  const apagar = async (e: Evento) => {
    if (!(await confirmar({ titulo: `Apagar o evento «${e.nome || e.ref}»?`, texto: "Não dá para anular.", ok: "Apagar", perigo: true }))) return;
    try { await deleteDoc(doc(db, "events", e.id)); setAberto(null); setEd(null); flash("Evento apagado"); } catch (er) { flash(errMsg(er)); }
  };
  const novo = () => { const ref = proximaRef("E", list.map((e) => e.ref || e.id)); setAberto(null); setEd({ ...eventoVazio(ref), _novo: true }); };

  const S = (k: Col, l: string, cls = "", desc = false) => th(sort, setSort, k, l, cls, desc);
  const set = (k: keyof F) => (v: string) => setF({ ...f, [k]: v });
  const det = ed || atual;
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
      </div>
      {!rows.length ? <Empty title="Nada encontrado" text="Muda a pesquisa, o ano ou os filtros." /> : (
        <div className="tbl stbl ptbl inv-tbl">
          <table>
            <thead><tr>
              {S("ref", "Ref", "", true)}{S("nome", "Evento")}{S("inicio", "Data", "n", true)}{S("tipo", "Tipo")}{S("papel", "Papel")}{S("parceiro", "Parceiro")}
            </tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id} tabIndex={0} onClick={() => setAberto(e.id)} onKeyDown={(k) => { if (k.key === "Enter" && k.target === k.currentTarget) setAberto(e.id); }}>
                <td className="mut refc">{e.ref}</td>
                <td><b className="inv-n">{e.nome}</b><span className="mut sm">{[e.objetivo, e.pais !== "Portugal" ? e.pais : ""].filter(Boolean).join(" · ")}</span></td>
                <td className="n mut">{dataPt(e.inicio)}</td>
                <td>{e.tipo ? <Tag v={e.tipo} /> : <span className="mut">-</span>}</td>
                <td>{e.papel ? <Tag v={e.papel} /> : <span className="mut">-</span>}</td>
                <td>{e.parceiro || <span className="mut">-</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </>}
    {det && (
      <Detalhe titulo={det.nome} refTxt={det.ref} editando={!!ed}
        tags={<>{det.tipo && <Tag v={det.tipo} />}{det.papel && <Tag v={det.papel} />}{det.objetivo && <Tag v={det.objetivo} />}</>}
        onClose={() => { setEd(null); setAberto(null); }} onEditar={() => atual && setEd({ ...atual })} onCancelar={() => setEd(null)}
        onGuardar={guardar} onApagar={ed?._novo ? undefined : () => apagar(det)}
        leitura={<>
          <h5 className="fsec">Evento</h5>
          <Dados itens={[["Data", datas(det) || "Por definir"], ["País", det.pais], ["Tipo", det.tipo], ["Âmbito", det.ambito], ["Objetivo", det.objetivo], ["Papel da Sogrape", det.papel]]} />
          <h5 className="fsec">Parceria e custos</h5>
          <Dados itens={[["Parceiro", det.parceiro ? <>{det.parceiro}{det.parceiroRef && <span className="mut"> · {det.parceiroRef}</span>}</> : det.parceria ? "Sim, sem parceiro indicado" : "Sem parceria"],
            ["Patrocínio", det.patrocinio ? (eur(det.valorPatrocinio) || "Sim") : "Não"], ["Gasto", eur(det.gasto) || "Sem custos registados"]]} />
          {det.observacoes && <><h5 className="fsec">Observações</h5><p className="inv-desc">{det.observacoes}</p></>}
        </>}
        edicao={ed && <div className="fgrid">
          <label className="fld full"><span>Nome</span><input autoComplete="off" value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></label>
          <Sel label="Tipo" value={ed.tipo} opcoes={TIPOS_EV} onChange={(v) => setEd({ ...ed, tipo: v })} />
          <Sel label="Objetivo" value={ed.objetivo} opcoes={OBJETIVOS_EV} onChange={(v) => setEd({ ...ed, objetivo: v })} />
          <Sel label="Âmbito" value={ed.ambito} opcoes={AMBITOS} onChange={(v) => setEd({ ...ed, ambito: v })} />
          <Sel label="Papel" value={ed.papel} opcoes={PAPEIS} onChange={(v) => setEd({ ...ed, papel: v })} />
          <label className="fld"><span>Início</span><input type="date" value={ed.inicio} onChange={(e) => setEd({ ...ed, inicio: e.target.value, fim: !ed.fim || ed.fim < e.target.value ? e.target.value : ed.fim })} /></label>
          <label className="fld"><span>Fim</span><input type="date" value={ed.fim} min={ed.inicio || undefined} onChange={(e) => setEd({ ...ed, fim: e.target.value })} /></label>
          <label className="fld"><span>País</span><input value={ed.pais} onChange={(e) => setEd({ ...ed, pais: e.target.value })} /></label>
          <SimNao label="Parceria" value={ed.parceria} onChange={(v) => setEd({ ...ed, parceria: v })} />
          <Parceiro nome={ed.parceiro} parceiros={parceiros} onChange={(nome, ref) => setEd({ ...ed, parceiro: nome, parceiroRef: ref, parceria: ed.parceria || !!nome.trim() })} />
          <label className="fld"><span>Ref. do parceiro</span><input value={ed.parceiroRef || (ed.parceiro.trim() ? "Nova, ao guardar" : "")} readOnly tabIndex={-1} /></label>
          <SimNao label="Patrocínio" value={ed.patrocinio} onChange={(v) => setEd({ ...ed, patrocinio: v })} />
          <Eur label="Gasto (€)" v={ed.gasto} on={(n) => setEd({ ...ed, gasto: n })} />
          <Eur label="Valor do patrocínio (€)" v={ed.valorPatrocinio} on={(n) => setEd({ ...ed, valorPatrocinio: n, patrocinio: ed.patrocinio || (n ?? 0) > 0 })} />
          <label className="fld full"><span>Observações</span><textarea rows={2} value={ed.observacoes} onChange={(e) => setEd({ ...ed, observacoes: e.target.value })} /></label>
        </div>} />
    )}
    {cfEl}
    {el}
  </>);
}
