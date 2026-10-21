"use client";
import { useMemo, useState } from "react";
import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { AreaSelect, CatSelect } from "@/components/CatSelect";
import { useAreas } from "@/lib/use-areas";
import { ESTADOS_PROJ, HORIZONTES, MWB, Projeto, RELACOES, anosDoProjeto, dataPt, eur, parceirosDe, projetoVazio, projetosDoExcel, proximaRef, type Evento } from "@/lib/inovacao";
import { Empty, SearchField } from "../ui";
import { errMsg, useFlash } from "../admin/common";
import { useConfirm } from "../Confirm";
import { Dados, Detalhe, Eur, ImportarExcel, Kpis, opcoes, ordenar, Parceiro, Sel, SimNao, Tag, th, useLive } from "./shared";

type Col = "ref" | "nome" | "estado" | "mwb" | "parceiro" | "inicio" | "orcamento";
type F = { ano: string; estado: string; mwb: string; cadeia: string; relacao: string };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ANO = String(new Date().getFullYear());
const OPC_ESTADO = opcoes(ESTADOS_PROJ.map((e) => ({ id: e.id, nome: e.id, cor: e.cor })));
const OPC_MWB = opcoes(MWB), OPC_REL = opcoes(RELACOES);

/** Projetos de Inovação: lista ou quadro por estado, filtros, detalhe, criar, editar e apagar. */
export function ProjetosView() {
  const { list, loaded, erro } = useLive<Projeto>("projects");
  const { list: eventos } = useLive<Evento>("events");
  const areas = useAreas();
  const { flash, el } = useFlash();
  const { confirmar, el: cfEl } = useConfirm();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>({ ano: ANO, estado: "all", mwb: "all", cadeia: "all", relacao: "all" });
  const [vista, setVista] = useState<"lista" | "quadro">("lista");
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "ref", dir: -1 });
  const [aberto, setAberto] = useState<string | null>(null);
  const [ed, setEd] = useState<(Projeto & { _novo?: boolean }) | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const parceiros = useMemo(() => parceirosDe([...list, ...eventos]), [list, eventos]);
  const cadNome = (id: string) => areas.find((a) => a.id === id)?.nome || "";
  const anos = useMemo(() => opcoes([...new Set([ANO, ...list.flatMap(anosDoProjeto)])].sort().reverse(), false), [list]);
  // Cada filtro conta com os outros aplicados (o próprio não conta)
  const passa = (p: Projeto, sem?: keyof F) => (sem === "ano" || f.ano === "all" || anosDoProjeto(p).includes(f.ano)) && (sem === "estado" || f.estado === "all" || p.estado === f.estado) &&
    (sem === "mwb" || f.mwb === "all" || p.mwb === f.mwb) && (sem === "cadeia" || f.cadeia === "all" || p.cadeia === f.cadeia) && (sem === "relacao" || f.relacao === "all" || p.relacao === f.relacao) &&
    (!q.trim() || norm([p.ref, p.nome, p.descricao, p.parceiro, p.observacoes].join(" ")).includes(norm(q.trim())));
  const conta = (k: keyof F, campo: (p: Projeto) => boolean) => list.filter((p) => passa(p, k) && campo(p)).length;
  const filtrados = useMemo(() => list.filter((p) => passa(p)), [list, f, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => ordenar(filtrados, (p) => sort.col === "estado" ? ESTADOS_PROJ.findIndex((e) => e.id === p.estado) : sort.col === "orcamento" ? p.orcamento : (p[sort.col] || "").toString().toLowerCase(), sort.dir), [filtrados, sort]);
  const soma = (k: "orcamento" | "gasto") => filtrados.reduce((t, p) => t + (p[k] || 0), 0);
  const atual = aberto ? list.find((p) => p.id === aberto) || null : null;

  const guardar = async () => {
    if (!ed) return;
    if (!ed.nome.trim()) { flash("Indica o nome do projeto."); return; }
    const { id, _novo, ...x } = ed;
    const agora = new Date().toISOString();
    const parceiroRef = x.parceiro.trim() && !x.parceiroRef ? proximaRef("PA", [...list, ...eventos].map((y) => y.parceiroRef || "")) : x.parceiro.trim() ? x.parceiroRef : "";
    try {
      await setDoc(doc(db, "projects", id), { ...x, parceiro: x.parceiro.trim(), parceiroRef, atualizadoEm: agora, criadoEm: x.criadoEm || agora });
      setEd(null); setAberto(id); flash(_novo ? `Projeto ${id} criado` : "Projeto guardado");
    } catch (e) { flash(errMsg(e)); }
  };
  const apagar = async (p: Projeto) => {
    if (!(await confirmar({ titulo: `Apagar o projeto «${p.nome || p.ref}»?`, texto: "Não dá para anular.", ok: "Apagar", perigo: true }))) return;
    try { await deleteDoc(doc(db, "projects", p.id)); setAberto(null); setEd(null); flash("Projeto apagado"); } catch (e) { flash(errMsg(e)); }
  };
  const novo = () => { const ref = proximaRef("PR", list.map((p) => p.ref || p.id)); setAberto(null); setEd({ ...projetoVazio(ref), _novo: true }); };
  const mudarEstado = (id: string, estado: string) => {
    const p = list.find((x) => x.id === id);
    if (!p || p.estado === estado) return;
    updateDoc(doc(db, "projects", id), { estado, atualizadoEm: new Date().toISOString() }).then(() => flash(`«${p.nome}» passou para ${estado}`)).catch((e) => flash(errMsg(e)));
  };

  const S = (k: Col, l: string, cls = "", desc = false) => th(sort, setSort, k, l, cls, desc);
  const set = (k: keyof F) => (v: string) => setF({ ...f, [k]: v });
  const det = ed || atual;
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
        { l: "Projetos", v: filtrados.length }, { l: "On Going", v: filtrados.filter((p) => p.estado === "On Going").length },
        { l: "Com piloto", v: filtrados.filter((p) => p.piloto).length }, { l: "Orçamento estimado", v: eur(soma("orcamento")) || "0 €" }, { l: "Gasto", v: eur(soma("gasto")) || "0 €" },
      ]} />
      <div className="toolbar">
        <CatSelect cats={anos} value={f.ano} onChange={set("ano")} simples counts={(a) => conta("ano", (p) => anosDoProjeto(p).includes(a))} allLabel="Todos os anos" procurar="Procurar ano" />
        <CatSelect cats={OPC_ESTADO} value={f.estado} onChange={set("estado")} simples counts={(id) => conta("estado", (p) => p.estado === id)} allLabel="Todos os estados" procurar="Procurar estado" />
        <CatSelect cats={OPC_MWB} value={f.mwb} onChange={set("mwb")} simples counts={(id) => conta("mwb", (p) => p.mwb === id)} allLabel="Todas as Must Win Battles" procurar="Procurar" />
        <AreaSelect areas={areas} value={f.cadeia} onChange={set("cadeia")} counts={(id) => conta("cadeia", (p) => p.cadeia === id)} />
        <CatSelect cats={OPC_REL} value={f.relacao} onChange={set("relacao")} simples counts={(id) => conta("relacao", (p) => p.relacao === id)} allLabel="Todas as relações" procurar="Procurar" />
        <span className="sp" />
        <div className="seg" role="group" aria-label="Vista">
          <button aria-pressed={vista === "lista"} onClick={() => setVista("lista")} title="Lista"><Icon name="list-bullets" />Lista</button>
          <button aria-pressed={vista === "quadro"} onClick={() => setVista("quadro")} title="Quadro"><Icon name="kanban" />Quadro</button>
        </div>
      </div>
      {vista === "quadro" ? (
        <div className="board inv-board">
          {ESTADOS_PROJ.map((e) => { const l = rows.filter((p) => p.estado === e.id); return (
            <section key={e.id} className={`bcol${over === e.id ? " over" : ""}`} aria-label={e.id}
              onDragOver={(ev) => { ev.preventDefault(); setOver(e.id); }} onDragLeave={() => setOver(null)} onDrop={(ev) => { ev.preventDefault(); setOver(null); mudarEstado(ev.dataTransfer.getData("text/proj"), e.id); }}>
              <header><i className="inv-dot" style={{ background: e.cor }} /><b>{e.id}</b><span className="c soft">{l.length}</span></header>
              <div className="bcards">
                {l.map((p) => (
                  <article key={p.id} className="dcard inv-card" draggable onDragStart={(ev) => { ev.dataTransfer.setData("text/proj", p.id); ev.dataTransfer.effectAllowed = "move"; }}
                    role="button" tabIndex={0} aria-label={`Abrir ${p.nome}`} onClick={() => setAberto(p.id)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setAberto(p.id); } }}>
                    <div className="dc1"><b>{p.nome}</b></div>
                    <div className="dc2">{[p.parceiro, cadNome(p.cadeia)].filter(Boolean).join(" · ") || p.ref}</div>
                    <div className="dc3"><Tag v={p.mwb} />{p.piloto && <span className="tg">Piloto</span>}<span className="sp" />{p.orcamento ? <span className="mut sm">{eur(p.orcamento)}</span> : null}</div>
                  </article>))}
                {!l.length && <p className="bempty">Sem projetos</p>}
              </div>
            </section>); })}
        </div>
      ) : !rows.length ? <Empty title="Nada encontrado" text="Muda a pesquisa, o ano ou os filtros." /> : (
        <div className="tbl stbl ptbl inv-tbl">
          <table>
            <thead><tr>
              {S("ref", "Ref", "", true)}{S("nome", "Projeto")}{S("estado", "Estado")}{S("mwb", "Must Win Battle")}{S("parceiro", "Parceiro")}{S("inicio", "Início", "n", true)}{S("orcamento", "Orçamento", "n", true)}
            </tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} tabIndex={0} onClick={() => setAberto(p.id)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) setAberto(p.id); }}>
                <td className="mut refc">{p.ref}</td>
                <td><b className="inv-n">{p.nome}</b><span className="mut sm clip" title={p.descricao}>{p.descricao}</span></td>
                <td><Tag v={p.estado} dot />{p.piloto && <span className="mut sm">Com piloto</span>}</td>
                <td>{p.mwb ? <Tag v={p.mwb} /> : <span className="mut">-</span>}</td>
                <td>{p.parceiro || <span className="mut">-</span>}{p.relacao && <span className="mut sm">{p.relacao}</span>}</td>
                <td className="n mut">{dataPt(p.inicio)}</td>
                <td className="n">{eur(p.orcamento) || <span className="mut">-</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </>}
    {det && (
      <Detalhe titulo={det.nome} refTxt={det.ref} editando={!!ed}
        tags={<><Tag v={det.estado} dot />{det.mwb && <Tag v={det.mwb} />}{det.horizonte && <Tag v={det.horizonte} />}{det.piloto && <span className="tg">Piloto</span>}</>}
        onClose={() => { setEd(null); setAberto(null); }} onEditar={() => atual && setEd({ ...atual })} onCancelar={() => { if (ed?._novo) setEd(null); else setEd(null); }}
        onGuardar={guardar} onApagar={ed?._novo ? undefined : () => apagar(det)}
        leitura={<>
          {det.descricao && <p className="inv-desc">{det.descricao}</p>}
          <h5 className="fsec">Enquadramento</h5>
          <Dados itens={[["Must Win Battle", det.mwb], ["Cadeia de valor", cadNome(det.cadeia)], ["Horizonte de inovação", det.horizonte], ["Estado", det.estado]]} />
          <h5 className="fsec">Parceiro</h5>
          <Dados itens={[["Parceiro", det.parceiro ? <>{det.parceiro}{det.parceiroRef && <span className="mut"> · {det.parceiroRef}</span>}</> : "Sem parceiro"], ["Relação", det.relacao],
            ["Piloto", det.piloto ? (det.pilotoDesde ? `Sim, em discussão desde ${dataPt(det.pilotoDesde)}` : "Sim") : "Não"]]} />
          <h5 className="fsec">Datas e orçamento</h5>
          <Dados itens={[["Início", dataPt(det.inicio) || "Por definir"], ["Fim", dataPt(det.fim) || (det.estado === "Ended" ? "Sem data" : "Em aberto")],
            ["Orçamento estimado", eur(det.orcamento) || "Sem dados"], ["Orçamento gasto", eur(det.gasto) || "Sem dados"]]} />
          {det.observacoes && <><h5 className="fsec">Observações</h5><p className="inv-desc">{det.observacoes}</p></>}
        </>}
        edicao={ed && <div className="fgrid">
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
        </div>} />
    )}
    {cfEl}
    {el}
  </>);
}
