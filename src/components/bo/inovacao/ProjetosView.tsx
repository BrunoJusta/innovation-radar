"use client";
import { useMemo, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { useAreas } from "@/lib/use-areas";
import { ESTADOS_PROJ, HORIZONTES, MWB, Projeto, RELACOES, dataPt, eur, parceirosDe, projetoVazio, projetosDoExcel, proximaRef, type Evento } from "@/lib/inovacao";
import { Empty, SearchField } from "../ui";
import { errMsg, FormModal, useFlash } from "../admin/common";
import { useConfirm } from "../Confirm";
import { Eur, ImportarExcel, Kpis, ordenar, Parceiro, Sel, SimNao, th, useLive } from "./shared";

type Col = "ref" | "nome" | "estado" | "mwb" | "cadeia" | "horizonte" | "parceiro" | "inicio" | "fim" | "orcamento" | "gasto";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Projetos de Inovação: lista, filtros, criar, editar e apagar. */
export function ProjetosView() {
  const { list, loaded, erro } = useLive<Projeto>("projects");
  const { list: eventos } = useLive<Evento>("events");
  const areas = useAreas();
  const { flash, el } = useFlash();
  const { confirmar, el: cfEl } = useConfirm();
  const [q, setQ] = useState("");
  const [fEst, setFEst] = useState("all");
  const [fMwb, setFMwb] = useState("");
  const [fCad, setFCad] = useState("");
  const [fRel, setFRel] = useState("");
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "ref", dir: -1 });
  const [ed, setEd] = useState<(Projeto & { _novo?: boolean }) | null>(null);

  const parceiros = useMemo(() => parceirosDe([...list, ...eventos]), [list, eventos]);
  const cadNome = (id: string) => areas.find((a) => a.id === id)?.nome || "";
  const base = useMemo(() => list.filter((p) =>
    (!fMwb || p.mwb === fMwb) && (!fCad || p.cadeia === fCad) && (!fRel || p.relacao === fRel) &&
    (!q.trim() || norm([p.ref, p.nome, p.descricao, p.parceiro, p.observacoes].join(" ")).includes(norm(q.trim())))), [list, fMwb, fCad, fRel, q]);
  const rows = useMemo(() => {
    const l = base.filter((p) => fEst === "all" || p.estado === fEst);
    const v = (p: Projeto): string | number | null => {
      switch (sort.col) {
        case "estado": return ESTADOS_PROJ.findIndex((e) => e.id === p.estado);
        case "cadeia": return cadNome(p.cadeia);
        case "orcamento": case "gasto": return p[sort.col];
        default: return (p[sort.col] || "").toString().toLowerCase();
      }
    };
    return ordenar(l, v, sort.dir);
  }, [base, fEst, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const soma = (k: "orcamento" | "gasto") => rows.reduce((t, p) => t + (p[k] || 0), 0);

  const guardar = async () => {
    if (!ed) return;
    if (!ed.nome.trim()) { flash("Indica o nome do projeto."); return; }
    const { id, _novo, ...x } = ed;
    const agora = new Date().toISOString();
    const parceiroRef = x.parceiro.trim() && !x.parceiroRef ? proximaRef("PA", [...list, ...eventos].map((y) => y.parceiroRef || "")) : x.parceiro.trim() ? x.parceiroRef : "";
    try {
      await setDoc(doc(db, "projects", id), { ...x, parceiro: x.parceiro.trim(), parceiroRef, atualizadoEm: agora, criadoEm: x.criadoEm || agora });
      setEd(null); flash(_novo ? `Projeto ${id} criado` : "Projeto guardado");
    } catch (e) { flash(errMsg(e)); }
  };
  const apagar = async () => {
    if (!ed || !(await confirmar({ titulo: `Apagar o projeto «${ed.nome || ed.ref}»?`, texto: "Não dá para anular.", ok: "Apagar", perigo: true }))) return;
    try { await deleteDoc(doc(db, "projects", ed.id)); setEd(null); flash("Projeto apagado"); } catch (e) { flash(errMsg(e)); }
  };
  const novo = () => { const ref = proximaRef("PR", list.map((p) => p.ref || p.id)); setEd({ ...projetoVazio(ref), _novo: true }); };

  const S = (k: Col, l: string, cls = "", desc = false) => th(sort, setSort, k, l, cls, desc);
  return (<>
    <div className="head">
      <div><h1>Projetos</h1><p>Os projetos e pilotos de Inovação, com parceiros, datas e orçamento.</p></div>
      <div className="pageact">
        <SearchField value={q} onChange={setQ} placeholder="Pesquisar projetos" />
        {loaded && !erro && !list.length && <ImportarExcel folha="Fact_Projects" col="projects" conv={projetosDoExcel} nome="projetos" notify={flash} />}
        <button className="btn primary" onClick={novo} disabled={!!erro}><Icon name="plus" />Novo projeto</button>
      </div>
    </div>
    {!loaded ? <div className="loading">A carregar…</div> : erro ? <Empty title="Sem acesso aos projetos" text={erro} /> : !list.length ? <Empty title="Ainda não há projetos" text="Cria o primeiro ou importa a folha «Fact_Projects» do Excel de Inovação." /> : <>
      <Kpis itens={[
        { l: "Projetos", v: rows.length }, { l: "On Going", v: rows.filter((p) => p.estado === "On Going").length },
        { l: "Com piloto", v: rows.filter((p) => p.piloto).length }, { l: "Orçamento estimado", v: eur(soma("orcamento")) || "0 €" }, { l: "Gasto", v: eur(soma("gasto")) || "0 €" },
      ]} />
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Estado">
          <button aria-pressed={fEst === "all"} onClick={() => setFEst("all")}>Todos<span className="sc">{base.length}</span></button>
          {ESTADOS_PROJ.map((e) => { const n = base.filter((p) => p.estado === e.id).length; return n || fEst === e.id ? (
            <button key={e.id} aria-pressed={fEst === e.id} onClick={() => setFEst(e.id)}><i className="inv-dot" style={{ background: e.cor }} />{e.id}<span className="sc">{n}</span></button>) : null; })}
        </div>
        <label className={`fsel${fMwb ? " on" : ""}`}><select value={fMwb} onChange={(e) => setFMwb(e.target.value)} aria-label="Must Win Battle">
          <option value="">Todas as Must Win Battles</option>{MWB.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className={`fsel${fCad ? " on" : ""}`}><select value={fCad} onChange={(e) => setFCad(e.target.value)} aria-label="Cadeia de valor">
          <option value="">Todas as cadeias de valor</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
        <label className={`fsel${fRel ? " on" : ""}`}><select value={fRel} onChange={(e) => setFRel(e.target.value)} aria-label="Relação">
          <option value="">Todas as relações</option>{RELACOES.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      {!rows.length ? <Empty title="Nada encontrado" text="Muda a pesquisa ou os filtros." /> : (
        <div className="tbl stbl ptbl inv-tbl">
          <table>
            <thead><tr>
              {S("ref", "Ref", "", true)}{S("nome", "Projeto")}{S("estado", "Estado")}{S("mwb", "Must Win Battle")}{S("cadeia", "Cadeia de valor")}
              {S("horizonte", "Horizonte")}{S("parceiro", "Parceiro")}{S("inicio", "Início", "n", true)}{S("fim", "Fim", "n", true)}{S("orcamento", "Orçamento", "n", true)}{S("gasto", "Gasto", "n", true)}
            </tr></thead>
            <tbody>{rows.map((p) => { const est = ESTADOS_PROJ.find((e) => e.id === p.estado); return (
              <tr key={p.id} tabIndex={0} onClick={() => setEd(p)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) setEd(p); }}>
                <td className="mut refc">{p.ref}</td>
                <td><b className="inv-n">{p.nome}</b><span className="mut sm clip" title={p.descricao}>{p.descricao}</span></td>
                <td><span className="tg"><i className="inv-dot" style={{ background: est?.cor || "#94A3B8" }} />{p.estado}</span>{p.piloto && <span className="mut sm">Piloto</span>}</td>
                <td>{p.mwb || <span className="mut">-</span>}</td>
                <td>{cadNome(p.cadeia) || <span className="mut">-</span>}</td>
                <td>{p.horizonte.replace(" Innovation", "") || <span className="mut">-</span>}</td>
                <td>{p.parceiro || <span className="mut">-</span>}{p.relacao && <span className="mut sm">{p.relacao}</span>}</td>
                <td className="n mut">{dataPt(p.inicio)}</td><td className="n mut">{dataPt(p.fim)}</td>
                <td className="n">{eur(p.orcamento) || <span className="mut">-</span>}</td><td className="n">{eur(p.gasto) || <span className="mut">-</span>}</td>
              </tr>); })}</tbody>
          </table>
        </div>)}
    </>}
    {ed && (
      <FormModal title={ed._novo ? `Novo projeto · ${ed.ref}` : `${ed.ref} · ${ed.nome}`} onClose={() => setEd(null)} onSave={guardar}>
        <div className="fgrid">
          <label className="fld wide"><span>Nome</span><input autoComplete="off" value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></label>
          <Sel label="Estado" value={ed.estado} opcoes={ESTADOS_PROJ.map((e) => e.id)} onChange={(v) => setEd({ ...ed, estado: v })} />
          <SimNao label="Piloto" value={ed.piloto} onChange={(v) => setEd({ ...ed, piloto: v })} />
          <label className="fld full"><span>Descrição</span><textarea rows={4} value={ed.descricao} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} /></label>
          <Sel label="Must Win Battle" value={ed.mwb} opcoes={MWB} onChange={(v) => setEd({ ...ed, mwb: v })} />
          <Sel label="Cadeia de valor" value={ed.cadeia} opcoes={areas.map((a) => ({ id: a.id, nome: a.nome }))} onChange={(v) => setEd({ ...ed, cadeia: v })} />
          <Sel label="Horizonte de inovação" value={ed.horizonte} opcoes={HORIZONTES} onChange={(v) => setEd({ ...ed, horizonte: v })} />
          <Sel label="Relação com o parceiro" value={ed.relacao} opcoes={RELACOES} onChange={(v) => setEd({ ...ed, relacao: v })} />
          <Parceiro nome={ed.parceiro} parceiros={parceiros} onChange={(nome, ref) => setEd({ ...ed, parceiro: nome, parceiroRef: ref })} />
          <label className="fld"><span>Início da discussão do piloto</span><input type="date" value={ed.pilotoDesde} onChange={(e) => setEd({ ...ed, pilotoDesde: e.target.value })} /></label>
          <label className="fld"><span>Ref. do parceiro</span><input value={ed.parceiroRef || (ed.parceiro.trim() ? "Nova, ao guardar" : "")} readOnly tabIndex={-1} /></label>
          <label className="fld"><span>Início</span><input type="date" value={ed.inicio} onChange={(e) => setEd({ ...ed, inicio: e.target.value })} /></label>
          <label className="fld"><span>Fim</span><input type="date" value={ed.fim} onChange={(e) => setEd({ ...ed, fim: e.target.value })} /></label>
          <Eur label="Orçamento estimado (€)" v={ed.orcamento} on={(n) => setEd({ ...ed, orcamento: n })} />
          <Eur label="Orçamento gasto (€)" v={ed.gasto} on={(n) => setEd({ ...ed, gasto: n })} />
          <label className="fld full"><span>Observações</span><textarea rows={2} value={ed.observacoes} onChange={(e) => setEd({ ...ed, observacoes: e.target.value })} /></label>
        </div>
        {!ed._novo && <button type="button" className="txtbtn danger inv-del" onClick={apagar}><Icon name="trash" />Apagar projeto</button>}
      </FormModal>
    )}
    {cfEl}
    {el}
  </>);
}
