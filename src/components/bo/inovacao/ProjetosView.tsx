"use client";
import { useEffect, useMemo, useState } from "react";
import { deleteDoc, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { AreaSelect, CatSelect } from "@/components/CatSelect";
import { useAreas } from "@/lib/use-areas";
import { DESTINOS_PROJ, ESTADOS_PROJ, FASES_PROJ, ONGOING, corDe, estadoNorm, faseNorm, MWB, Projeto, RELACOES, anosDoProjeto, dataPt, eur, parceirosDe, projetoVazio, projetosDoExcel, proximaRef, type Evento } from "@/lib/inovacao";
import { Empty, SearchField } from "../ui";
import { errMsg, useFlash } from "../admin/common";
import { useConfirm } from "../Confirm";
import { ProjetoFicha, ProjetoForm } from "./ProjetoFicha";
import { Detalhe, ImportarExcel, Kpis, opcoes, ordenar, Tag, th, useLive } from "./shared";
import type { Startup } from "@/lib/types";
import { useCategorias } from "@/lib/use-areas";
import { approveStartup, rejectStartup, startupBackToTriage } from "@/lib/startup-actions";
import { StartupDrawer } from "../startups/StartupDrawer";
import { DealsLookup } from "../pipeline/DealsLookup";
import { useSession } from "../AuthGate";

type Col = "ref" | "nome" | "fase" | "mwb" | "parceiro" | "inicio" | "orcamento";
type F = { ano: string; mwb: string; cadeia: string; relacao: string };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ANO = String(new Date().getFullYear());
/** Cores dos cabeçalhos dos stages: tons de ferrugem, do mais forte (início) ao mais leve (fim). */
const COR_FASE = ["#EBC9B9", "#F0D6CA", "#F4E2D9", "#F8ECE6"];
const SEM = "_";
const TO_START = "To Start";
/** Coluna de entrada do quadro (os projetos em To Start). */
const ENTRADA = "__entrada";
const OPC_MWB = opcoes(MWB), OPC_REL = opcoes(RELACOES);

/** Projetos de Inovação: lista ou quadro por estado, filtros, detalhe, criar, editar e apagar. */
export function ProjetosView() {
  const { list: brutos, loaded, erro } = useLive<Projeto>("projects");
  // Estados e stages com nomes antigos passam para os atuais (On Going → Ongoing, Transferred to BU → Graduated, Ended → Shelved)
  // e os projetos sem stage (que não estejam em To Start, a porta de entrada) entram no primeiro stage
  const novaFase = (p: Projeto) => { const e = estadoNorm(p.estado), f = faseNorm(p.fase); return e === TO_START || FASES_PROJ.includes(f) ? f : FASES_PROJ[0]; };
  const velho = (p: Projeto) => estadoNorm(p.estado) !== p.estado || novaFase(p) !== (p.fase || "");
  const list = useMemo(() => brutos.map((p) => (velho(p) ? { ...p, estado: estadoNorm(p.estado), fase: novaFase(p) } : p)), [brutos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const velhos = brutos.filter(velho);
    if (!velhos.length) return;
    const b = writeBatch(db); velhos.forEach((p) => b.update(doc(db, "projects", p.id), { estado: estadoNorm(p.estado), fase: novaFase(p) })); b.commit().catch(() => {});
  }, [brutos]); // eslint-disable-line react-hooks/exhaustive-deps
  const { list: startups } = useLive<Startup>("startups");
  // Detalhe da startup parceira, aberto a partir da ficha do projeto
  const [stId, setStId] = useState<string | null>(null);
  const categorias = useCategorias();
  const { email } = useSession();
  const [tab, setTab] = useState<string>(ONGOING);
  const { list: eventos } = useLive<Evento>("events");
  const areas = useAreas();
  const { flash, el } = useFlash();
  const { confirmar, el: cfEl } = useConfirm();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>({ ano: ANO, mwb: "all", cadeia: "all", relacao: "all" });
  const [vista, setVista] = useState<"lista" | "quadro">("quadro");
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "ref", dir: -1 });
  const [aberto, setAberto] = useState<string | null>(null);
  const [ed, setEd] = useState<(Projeto & { _novo?: boolean }) | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const parceiros = useMemo(() => parceirosDe([...list, ...eventos]), [list, eventos]);
  const cadNome = (id: string) => areas.find((a) => a.id === id)?.nome || "";
  const anos = useMemo(() => opcoes([...new Set([ANO, ...list.flatMap(anosDoProjeto)])].sort().reverse(), false), [list]);
  // Cada filtro conta com os outros aplicados (o próprio não conta)
  const passaF = (p: Projeto, sem?: keyof F) => (sem === "ano" || f.ano === "all" || anosDoProjeto(p).includes(f.ano)) &&
    (sem === "mwb" || f.mwb === "all" || p.mwb === f.mwb) && (sem === "cadeia" || f.cadeia === "all" || p.cadeia === f.cadeia) && (sem === "relacao" || f.relacao === "all" || p.relacao === f.relacao) &&
    (!q.trim() || norm([p.ref, p.nome, p.descricao, p.parceiro, p.observacoes].join(" ")).includes(norm(q.trim())));
  const passa = (p: Projeto, sem?: keyof F) => p.estado === tab && passaF(p, sem);
  const conta = (k: keyof F, campo: (p: Projeto) => boolean) => list.filter((p) => passa(p, k) && campo(p)).length;
  const filtrados = useMemo(() => list.filter((p) => passa(p)), [list, f, q, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => ordenar(filtrados, (p) => sort.col === "fase" ? (FASES_PROJ.indexOf(p.fase || "") + 1 || 99) : sort.col === "orcamento" ? p.orcamento : (p[sort.col] || "").toString().toLowerCase(), sort.dir), [filtrados, sort]);
  const soma = (k: "orcamento" | "gasto") => filtrados.reduce((t, p) => t + (p[k] || 0), 0);
  /** Quantos projetos há em cada estado, com os filtros aplicados. */
  const nTab = (estado: string) => list.filter((p) => p.estado === estado && passaF(p)).length;
  // Quadro: linhas por Must Win Battle e colunas por stage (com «por definir» só quando há projetos sem um ou sem o outro)
  // No quadro de Ongoing, os projetos em To Start aparecem na coluna de entrada, à esquerda dos stages
  const noQuadro = useMemo(() => tab === ONGOING ? list.filter((p) => (p.estado === ONGOING || p.estado === TO_START) && passaF(p)) : filtrados, [tab, list, filtrados, f, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const linhas = useMemo(() => [...MWB.map((m) => ({ id: m, nome: m })), ...(noQuadro.some((p) => !MWB.includes(p.mwb)) ? [{ id: SEM, nome: "Sem Must Win Battle" }] : [])], [noQuadro]);
  const colunas = tab === TO_START ? [ENTRADA] : tab === ONGOING ? [ENTRADA, ...FASES_PROJ] : FASES_PROJ;
  const naCelula = (m: string, fs: string) => noQuadro.filter((p) => (m === SEM ? !MWB.includes(p.mwb) : p.mwb === m) && (fs === ENTRADA ? p.estado === TO_START : p.estado !== TO_START && (FASES_PROJ.includes(p.fase || "") ? p.fase : FASES_PROJ[0]) === fs));
  const destinos = [...(tab !== ONGOING ? [ONGOING] : []), ...DESTINOS_PROJ.filter((d) => d !== tab)];
  /** Largar um cartão numa célula: muda o stage e a Must Win Battle. */
  const moverCelula = (id: string, m: string, fs: string) => {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    const upd: Partial<Projeto> = {};
    if (m !== SEM && p.mwb !== m) upd.mwb = m;
    if (fs === ENTRADA) { if (p.estado !== TO_START) upd.estado = TO_START; }
    else {
      if (p.estado === TO_START) upd.estado = ONGOING; // sai da porta de entrada
      if (p.fase !== fs) upd.fase = fs;
    }
    if (!Object.keys(upd).length) return;
    updateDoc(doc(db, "projects", id), { ...upd, atualizadoEm: new Date().toISOString() })
      .then(() => flash(`«${p.nome}» passou para ${[upd.estado, upd.fase, upd.mwb].filter(Boolean).join(", ")}`)).catch((e) => flash(errMsg(e)));
  };
  const atual = aberto ? list.find((p) => p.id === aberto) || null : null;

  const guardar = async () => {
    if (!ed) return;
    if (!ed.nome.trim()) { flash("Indica o nome do projeto."); return; }
    const { id, _novo, ...x } = ed;
    const agora = new Date().toISOString();
    const parceiroRef = x.parceiro.trim() && !x.parceiroRef ? proximaRef("PA", [...list, ...eventos].map((y) => y.parceiroRef || "")) : x.parceiro.trim() ? x.parceiroRef : "";
    try {
      await setDoc(doc(db, "projects", id), { ...x, parceiro: x.parceiro.trim(), parceiroRef, atualizadoEm: agora, criadoEm: x.criadoEm || agora });
      setEd(null); setAberto(id); flash(_novo ? "Projeto criado" : "Projeto guardado");
    } catch (e) { flash(errMsg(e)); }
  };
  const apagar = async (p: Projeto) => {
    if (!(await confirmar({ titulo: `Apagar o projeto «${p.nome || "sem nome"}»?`, texto: "Não dá para anular.", ok: "Apagar", perigo: true, escrever: "DELETE" }))) return;
    try { await deleteDoc(doc(db, "projects", p.id)); setAberto(null); setEd(null); flash("Projeto apagado"); } catch (e) { flash(errMsg(e)); }
  };
  const novo = () => { const ref = proximaRef("PR", list.map((p) => p.ref || p.id)); setAberto(null); setEd({ ...projetoVazio(ref), _novo: true }); };
  const mudarEstado = (id: string, estado: string) => {
    const p = list.find((x) => x.id === id);
    if (!p || p.estado === estado) return;
    const fase = estado !== TO_START && !FASES_PROJ.includes(p.fase || "") ? { fase: FASES_PROJ[0] } : {};
    updateDoc(doc(db, "projects", id), { estado, ...fase, atualizadoEm: new Date().toISOString() }).then(() => flash(`«${p.nome}» passou para ${estado}`)).catch((e) => flash(errMsg(e)));
  };

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
  const pagina = det && (<Detalhe voltar="Projetos" titulo={det.nome} editando={!!ed}
        tags={<><span className="tg inv-kind">{det.piloto ? "Piloto" : "Projeto"}</span><Tag v={det.estado} dot />{det.fase && <span className="tg">{det.fase}</span>}</>}
        onClose={() => { setEd(null); setAberto(null); }} onEditar={() => atual && setEd({ ...atual })} onCancelar={sair}
        onGuardar={guardar} onApagar={ed?._novo ? undefined : () => apagar(det)}
        leitura={<ProjetoFicha p={det} cadeia={cadNome(det.cadeia)} startup={startups.find((x) => x.id === det.startupId)} onStartup={() => setStId(det.startupId || null)} />}
        edicao={ed && <ProjetoForm ed={ed} setEd={(x) => setEd({ ...x, _novo: ed._novo })} areas={areas} startups={startups} parceiros={parceiros} />} />);
  const stOpen = stId ? startups.find((x) => x.id === stId) : undefined;
  if (det) return (<>
    {pagina}
    {stOpen && (
      <DealsLookup>
        <StartupDrawer s={stOpen} list={[stOpen]} sectors={categorias} areas={areas} onClose={() => setStId(null)} onNav={setStId} notify={flash}
          onApprove={() => approveStartup(stOpen, email).then(() => flash(`«${stOpen.nome}» aprovada`)).catch((e) => flash(errMsg(e)))}
          onReason={(m) => rejectStartup(stOpen, m).then(() => { setStId(null); flash(`«${stOpen.nome}» arquivada no arquivo de triagem`); }).catch((e) => flash(errMsg(e)))}
          onBack={() => startupBackToTriage(stOpen).then(() => flash(`«${stOpen.nome}» voltou à triagem`)).catch((e) => flash(errMsg(e)))} />
      </DealsLookup>
    )}
    {cfEl}
    {el}
  </>);
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
        { l: "Projetos", v: filtrados.length },
        { l: "Com piloto", v: filtrados.filter((p) => p.piloto).length }, { l: "Orçamento estimado", v: eur(soma("orcamento")) || "0 €" }, { l: "Gasto", v: eur(soma("gasto")) || "0 €" },
      ]} />
      <div className="seg trseg" role="group" aria-label="Estado dos projetos">
        {ESTADOS_PROJ.map((e) => <button key={e.id} aria-pressed={tab === e.id} onClick={() => setTab(e.id)}><i className="inv-dot" style={{ background: e.cor }} />{e.id}<span className="sc">{nTab(e.id)}</span></button>)}
      </div>
      <div className="toolbar">
        <CatSelect cats={anos} value={f.ano} onChange={set("ano")} simples counts={(a) => conta("ano", (p) => anosDoProjeto(p).includes(a))} allLabel="Todos os anos" procurar="Procurar ano" />
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
        <div className="pm-wrap">
          <div className="pm" style={{ ["--n" as string]: colunas.length }} role="grid" aria-label={`Quadro dos projetos ${tab}`}>
            <div className="pm-c0" aria-hidden="true" />
            {colunas.map((fs) => <div key={fs} className={`pm-h${fs === ENTRADA ? " sem" : ""}`} role="columnheader" style={fs === ENTRADA ? undefined : { background: COR_FASE[FASES_PROJ.indexOf(fs)] }}>{fs === ENTRADA ? "To Start" : fs}</div>)}
            <div className="pm-dh" aria-hidden="true" />
            {linhas.map((m, li) => (<div key={m.id} className="pm-row" role="row" style={{ display: "contents" }}>
              <div className="pm-l" role="rowheader" title={m.nome} style={{ ["--c" as string]: m.id === SEM ? "#94A3B8" : corDe(m.id) }}><span>{m.nome}</span></div>
              {colunas.map((fs) => { const k = `${m.id}|${fs}`, l = naCelula(m.id, fs); return (
                <div key={k} role="gridcell" className={`pm-cell${fs === ENTRADA ? " ent" : ""}${over === k ? " over" : ""}`} aria-label={`${m.nome}, ${fs === ENTRADA ? "To Start" : fs}: ${l.length}`}
                  onDragOver={(ev) => { ev.preventDefault(); setOver(k); }} onDragLeave={() => setOver(null)}
                  onDrop={(ev) => { ev.preventDefault(); setOver(null); moverCelula(ev.dataTransfer.getData("text/proj"), m.id, fs); }}>
                  {l.map((p) => (
                    <article key={p.id} className="pm-card" draggable onDragStart={(ev) => { ev.dataTransfer.setData("text/proj", p.id); ev.dataTransfer.effectAllowed = "move"; }}
                      role="button" tabIndex={0} aria-label={`Abrir ${p.nome}`} onClick={() => setAberto(p.id)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setAberto(p.id); } }}>
                      <b>{p.nome}</b>
                      {(p.parceiro || cadNome(p.cadeia)) && <span>{[p.parceiro, cadNome(p.cadeia)].filter(Boolean).join(", ")}</span>}
                      {(p.piloto || p.orcamento) ? <em>{p.piloto && <span className="tg">Piloto</span>}<i className="sp" />{p.orcamento ? eur(p.orcamento) : ""}</em> : null}
                    </article>))}
                </div>); })}
              {li === 0 && (
                <div className="pm-dest" style={{ gridRow: `2 / span ${linhas.length}` }}>
                  {destinos.map((d) => (
                    <div key={d} className={`pm-d${over === d ? " over" : ""}`} style={{ ["--c" as string]: corDe(d) }} title={`Larga aqui para passar para ${d}`}
                      onDragOver={(ev) => { ev.preventDefault(); setOver(d); }} onDragLeave={() => setOver(null)}
                      onDrop={(ev) => { ev.preventDefault(); setOver(null); mudarEstado(ev.dataTransfer.getData("text/proj"), d); }}>
                      <b>{d === "Graduated" ? "Graduated" : d}</b>{d === "Graduated" && <small>Transferred to BU</small>}<span>{nTab(d)}</span><em>Larga aqui</em>
                    </div>))}
                </div>)}
            </div>))}
          </div>
          <p className="pm-hint">{tab === ONGOING ? "Os projetos em To Start são a porta de entrada: arrasta-os para um stage para passarem a Ongoing. " : ""}Arrasta um projeto para outra célula para mudar o stage ou a Must Win Battle, ou para a direita para mudar o estado. No detalhe do projeto também dá para mudar tudo.</p>
        </div>
      ) : !rows.length ? <Empty title="Nada encontrado" text="Muda a pesquisa, o ano ou os filtros." /> : (
        <div className="tbl stbl ptbl inv-tbl">
          <table>
            <thead><tr>
              {S("nome", "Projeto")}{S("fase", "Stage")}{S("mwb", "Must Win Battle")}{S("parceiro", "Parceiro")}{S("inicio", "Início", "n", true)}{S("orcamento", "Orçamento", "n", true)}
            </tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} tabIndex={0} onClick={() => setAberto(p.id)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) setAberto(p.id); }}>
                <td><b className="inv-n">{p.nome}</b><span className="mut sm clip" title={p.descricao}>{p.descricao}</span></td>
                <td>{p.estado === "To Start" ? <span className="mut">-</span> : p.fase}{p.piloto && <span className="mut sm">Com piloto</span>}</td>
                <td>{p.mwb ? <Tag v={p.mwb} /> : <span className="mut">-</span>}</td>
                <td>{p.parceiro || <span className="mut">-</span>}{p.relacao && <span className="mut sm">{p.relacao}</span>}</td>
                <td className="n mut">{dataPt(p.inicio)}</td>
                <td className="n">{eur(p.orcamento) || <span className="mut">-</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </>}
    {cfEl}
    {el}
  </>);
}
