"use client";
import { useMemo, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { AMBITOS, Evento, OBJETIVOS_EV, PAPEIS, TIPOS_EV, dataPt, eur, eventoVazio, eventosDoExcel, parceirosDe, proximaRef, type Projeto } from "@/lib/inovacao";
import { Empty, SearchField } from "../ui";
import { errMsg, FormModal, useFlash } from "../admin/common";
import { useConfirm } from "../Confirm";
import { Eur, ImportarExcel, Kpis, ordenar, Parceiro, Sel, SimNao, th, useLive } from "./shared";

type Col = "ref" | "nome" | "inicio" | "tipo" | "objetivo" | "papel" | "pais" | "parceiro" | "gasto" | "valorPatrocinio";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const anoDe = (e: Evento) => (e.inicio || "").slice(0, 4);

/** Eventos de Inovação: lista por ano, filtros, criar, editar e apagar. */
export function EventosView() {
  const { list, loaded, erro } = useLive<Evento>("events");
  const { list: projetos } = useLive<Projeto>("projects");
  const { flash, el } = useFlash();
  const { confirmar, el: cfEl } = useConfirm();
  const [q, setQ] = useState("");
  const [fAno, setFAno] = useState(String(new Date().getFullYear()));
  const [fTipo, setFTipo] = useState("");
  const [fObj, setFObj] = useState("");
  const [fPapel, setFPapel] = useState("");
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "inicio", dir: -1 });
  const [ed, setEd] = useState<(Evento & { _novo?: boolean }) | null>(null);

  const parceiros = useMemo(() => parceirosDe([...projetos, ...list]), [projetos, list]);
  const anos = useMemo(() => [...new Set([String(new Date().getFullYear()), ...list.map(anoDe).filter(Boolean)])].sort().reverse(), [list]);
  const rows = useMemo(() => {
    const l = list.filter((e) => (fAno === "all" || anoDe(e) === fAno) && (!fTipo || e.tipo === fTipo) && (!fObj || e.objetivo === fObj) && (!fPapel || e.papel === fPapel) &&
      (!q.trim() || norm([e.ref, e.nome, e.parceiro, e.pais, e.observacoes].join(" ")).includes(norm(q.trim()))));
    return ordenar(l, (e) => (sort.col === "gasto" || sort.col === "valorPatrocinio" ? e[sort.col] : (e[sort.col] || "").toString().toLowerCase()), sort.dir);
  }, [list, fAno, fTipo, fObj, fPapel, q, sort]);
  const soma = (k: "gasto" | "valorPatrocinio") => rows.reduce((t, e) => t + (e[k] || 0), 0);

  const guardar = async () => {
    if (!ed) return;
    if (!ed.nome.trim()) { flash("Indica o nome do evento."); return; }
    if (!ed.inicio) { flash("Indica a data de início."); return; }
    const { id, _novo, ...x } = ed;
    const agora = new Date().toISOString();
    const parceiroRef = x.parceiro.trim() && !x.parceiroRef ? proximaRef("PA", [...projetos, ...list].map((y) => y.parceiroRef || "")) : x.parceiro.trim() ? x.parceiroRef : "";
    try {
      await setDoc(doc(db, "events", id), { ...x, fim: x.fim || x.inicio, parceiro: x.parceiro.trim(), parceiroRef, parceria: x.parceria || !!x.parceiro.trim(), atualizadoEm: agora, criadoEm: x.criadoEm || agora });
      setEd(null); flash(_novo ? `Evento ${id} criado` : "Evento guardado");
    } catch (e) { flash(errMsg(e)); }
  };
  const apagar = async () => {
    if (!ed || !(await confirmar({ titulo: `Apagar o evento «${ed.nome || ed.ref}»?`, texto: "Não dá para anular.", ok: "Apagar", perigo: true }))) return;
    try { await deleteDoc(doc(db, "events", ed.id)); setEd(null); flash("Evento apagado"); } catch (e) { flash(errMsg(e)); }
  };
  const novo = () => { const ref = proximaRef("E", list.map((e) => e.ref || e.id)); setEd({ ...eventoVazio(ref), _novo: true }); };

  const S = (k: Col, l: string, cls = "", desc = false) => th(sort, setSort, k, l, cls, desc);
  const fs = (on: boolean) => `fsel${on ? " on" : ""}`;
  return (<>
    <div className="head">
      <div><h1>Eventos</h1><p>Eventos, sessões de scouting, formações e podcasts em que a equipa de Inovação participou ou que organizou.</p></div>
      <div className="pageact">
        <SearchField value={q} onChange={setQ} placeholder="Pesquisar eventos" />
        {loaded && !erro && !list.length && <ImportarExcel folha="Fact_Events" col="events" conv={eventosDoExcel} nome="eventos" notify={flash} />}
        <button className="btn primary" onClick={novo} disabled={!!erro}><Icon name="plus" />Novo evento</button>
      </div>
    </div>
    {!loaded ? <div className="loading">A carregar…</div> : erro ? <Empty title="Sem acesso aos eventos" text={erro} /> : !list.length ? <Empty title="Ainda não há eventos" text="Cria o primeiro ou importa a folha «Fact_Events» do Excel de Inovação." /> : <>
      <Kpis itens={[
        { l: "Eventos", v: rows.length }, { l: "Como orador ou júri", v: rows.filter((e) => ["Speaker", "Jury", "Mentor", "Moderator"].includes(e.papel)).length },
        { l: "Organizados", v: rows.filter((e) => e.papel === "Organizer").length }, { l: "Com parceria", v: rows.filter((e) => e.parceria).length },
        { l: "Gasto", v: eur(soma("gasto")) || "0 €" }, { l: "Patrocínios", v: eur(soma("valorPatrocinio")) || "0 €" },
      ]} />
      <div className="toolbar">
        <label className={fs(fAno !== "all")}><select value={fAno} onChange={(e) => setFAno(e.target.value)} aria-label="Ano">
          <option value="all">Todos os anos</option>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        <label className={fs(!!fTipo)}><select value={fTipo} onChange={(e) => setFTipo(e.target.value)} aria-label="Tipo">
          <option value="">Todos os tipos</option>{TIPOS_EV.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className={fs(!!fObj)}><select value={fObj} onChange={(e) => setFObj(e.target.value)} aria-label="Objetivo">
          <option value="">Todos os objetivos</option>{OBJETIVOS_EV.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className={fs(!!fPapel)}><select value={fPapel} onChange={(e) => setFPapel(e.target.value)} aria-label="Papel">
          <option value="">Todos os papéis</option>{PAPEIS.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      {!rows.length ? <Empty title="Nada encontrado" text="Muda a pesquisa, o ano ou os filtros." /> : (
        <div className="tbl stbl ptbl inv-tbl">
          <table>
            <thead><tr>
              {S("ref", "Ref", "", true)}{S("nome", "Evento")}{S("inicio", "Data", "n", true)}{S("tipo", "Tipo")}{S("objetivo", "Objetivo")}{S("papel", "Papel")}
              {S("pais", "País")}{S("parceiro", "Parceiro")}{S("gasto", "Gasto", "n", true)}{S("valorPatrocinio", "Patrocínio", "n", true)}
            </tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id} tabIndex={0} onClick={() => setEd(e)} onKeyDown={(k) => { if (k.key === "Enter" && k.target === k.currentTarget) setEd(e); }}>
                <td className="mut refc">{e.ref}</td>
                <td><b className="inv-n">{e.nome}</b>{e.observacoes && <span className="mut sm clip" title={e.observacoes}>{e.observacoes}</span>}</td>
                <td className="n mut">{dataPt(e.inicio)}{e.fim && e.fim !== e.inicio && <span className="sm">até {dataPt(e.fim)}</span>}</td>
                <td>{e.tipo || <span className="mut">-</span>}{e.ambito && <span className="mut sm">{e.ambito}</span>}</td>
                <td>{e.objetivo || <span className="mut">-</span>}</td>
                <td>{e.papel ? <span className="tg">{e.papel}</span> : <span className="mut">-</span>}</td>
                <td>{e.pais || <span className="mut">-</span>}</td>
                <td>{e.parceiro || <span className="mut">-</span>}</td>
                <td className="n">{eur(e.gasto) || <span className="mut">-</span>}</td>
                <td className="n">{e.patrocinio ? eur(e.valorPatrocinio) || "Sim" : <span className="mut">-</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </>}
    {ed && (
      <FormModal title={ed._novo ? `Novo evento · ${ed.ref}` : `${ed.ref} · ${ed.nome}`} onClose={() => setEd(null)} onSave={guardar}>
        <div className="fgrid">
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
        </div>
        {!ed._novo && <button type="button" className="txtbtn danger inv-del" onClick={apagar}><Icon name="trash" />Apagar evento</button>}
      </FormModal>
    )}
    {cfEl}
    {el}
  </>);
}
