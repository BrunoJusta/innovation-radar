"use client";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { post } from "@/lib/api";
import { CATEGORIAS_V3 } from "@/lib/categorias";
import { useConfirm } from "@/components/bo/Confirm";
import { db } from "@/lib/firebase";
import { AREA_COLORS, Sector } from "@/lib/types";
import { slug } from "@/lib/util";
import { CATEGORY_ICONS, Icon } from "@/components/Icon";
import { AdmHead, DangerBtn, errMsg, FormModal, useFlash } from "./common";

type Edit = Omit<Sector, "pesquisas"> & { pq: string; _new?: boolean };

/** Setores das startups e as pesquisas online que a recolha semanal corre para cada um. */
export function SectorsView() {
  const [list, setList] = useState<Sector[]>([]);
  const [e, setE] = useState<Edit | null>(null);
  const { flash, el } = useFlash();
  useEffect(() => onSnapshot(query(collection(db, "sectors"), orderBy("ordem")), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Sector))), []);

  // Descrições e pesquisas sugeridas (src/lib/categorias.ts), casadas pelo nome com as categorias que existem
  const sugeridas = list.map((x) => ({ x, c: CATEGORIAS_V3[x.id] || CATEGORIAS_V3[slug(x.nome)] }))
    .filter(({ x, c }) => c && (x.descricao !== c.descricao || (x.pesquisas || []).join("\n") !== c.pesquisas.join("\n")));
  const aplicar = () => Promise.all(sugeridas.map(({ x, c }) => updateDoc(doc(db, "sectors", x.id), { descricao: c.descricao, pesquisas: c.pesquisas })))
    .then(() => flash("Descrições e pesquisas aplicadas")).catch((er) => flash(errMsg(er)));

  // Atribui uma categoria a todas as startups (triagem, aprovadas, arquivo de triagem) e a todos os deals do pipeline
  const { confirmar, el: cfEl } = useConfirm();
  const [prog, setProg] = useState<{ feitas: number; total: number } | null>(null);
  const atribuir = async () => {
    if (!(await confirmar({ titulo: "Atribuir uma categoria a todas as startups?", texto: "A Gemini classifica pela descrição todas as startups da base de dados (triagem, aprovadas e arquivo de triagem) e todas as do pipeline, radar, investidas e arquivo. Substitui as categorias que já existem.", ok: "Atribuir" }))) return;
    const cats = list.map(({ id, nome, descricao }) => ({ id, nome, descricao }));
    try {
      type Item = { id: string; nome: string; descricao: string };
      const st = (await getDocs(collection(db, "startups"))).docs.map((d) => ({ id: d.id, nome: String(d.data().nome || ""), descricao: String(d.data().descricao || "") }));
      const dl = (await getDocs(collection(db, "deals"))).docs.map((d) => ({ id: d.id, nome: String(d.data().nome || ""), descricao: String(d.data().descricao || ""), startupId: d.data().startupId as string | undefined }));
      const stIds = new Set(st.map((x) => x.id));
      // Os deals ligados a uma ficha herdam a categoria dela; os outros são classificados à parte
      const soltos: Item[] = dl.filter((d) => !d.startupId || !stIds.has(d.startupId)).map((d) => ({ id: `deal:${d.id}`, nome: d.nome, descricao: d.descricao || d.nome }));
      const todos: Item[] = [...st, ...soltos].filter((x) => x.nome);
      const res: Record<string, string> = {};
      setProg({ feitas: 0, total: todos.length });
      for (let i = 0; i < todos.length; i += 80) {
        const lote = todos.slice(i, i + 80);
        const j = await post<{ setores: Record<string, string> }>("/api/startups/setores", { startups: lote, sectors: cats });
        Object.assign(res, j.setores);
        const b = writeBatch(db);
        for (const x of lote) if (res[x.id] && !x.id.startsWith("deal:")) b.update(doc(db, "startups", x.id), { setor: res[x.id] });
        await b.commit();
        setProg({ feitas: Math.min(i + 80, todos.length), total: todos.length });
      }
      for (let i = 0; i < dl.length; i += 400) {
        const b = writeBatch(db);
        for (const d of dl.slice(i, i + 400)) { const c = (d.startupId && res[d.startupId]) || res[`deal:${d.id}`]; if (c) b.update(doc(db, "deals", d.id), { categoria: c }); }
        await b.commit();
      }
      flash(`Categoria atribuída a ${Object.keys(res).length} de ${todos.length} startups`);
    } catch (er) { flash(errMsg(er)); }
    setProg(null);
  };

  const save = async () => {
    if (!e || !e.nome.trim()) return flash("Indica o nome da categoria.");
    const { _new, id, pq, ...rest } = e;
    const pesquisas = pq.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12);
    try { await setDoc(doc(db, "sectors", _new ? slug(e.nome) : id), { ...rest, pesquisas }, { merge: true }); setE(null); flash("Categoria guardada"); }
    catch (er) { flash(errMsg(er)); }
  };

  return (<>
    <AdmHead title="Categorias e pesquisas" text="As categorias dizem que tipo de solução cada startup oferece e são um filtro do radar de startups (os anéis são as cadeias de valor). As pesquisas de cada categoria correm todas as segundas na recolha semanal (cada pesquisa conta como uma pesquisa Google da Gemini).">
      <button className="btn" onClick={atribuir} disabled={!!prog || !list.length} title="Atribuir com a Gemini uma categoria a todas as startups">
        {prog ? <><span className="spin" aria-hidden="true" />{prog.feitas} de {prog.total}</> : <><Icon name="sparkle" />Atribuir categorias</>}</button>
      <button className="btn primary" onClick={() => setE({ id: "", nome: "", cor: AREA_COLORS[list.length % AREA_COLORS.length], icone: "sparkle", descricao: "", ordem: list.length + 1, pq: "", _new: true })}><Icon name="plus" />Nova categoria</button>
    </AdmHead>
    {sugeridas.length > 0 && (
      <div className="notice warn scad"><span>Há descrições e pesquisas sugeridas para {sugeridas.length === 1 ? "1 categoria" : `${sugeridas.length} categorias`} ({sugeridas.map(({ x }) => x.nome).join(", ")}). Substituem as atuais.</span>
        <button className="btn primary" onClick={aplicar}><Icon name="sparkle" />Aplicar sugestões</button></div>
    )}
    <div className="rows">{list.map((s) => (
      <div className="row" key={s.id}>
        <span className="cic" style={{ color: s.cor }}><Icon name={s.icone} size={18} /></span>
        <div className="rmain"><b>{s.nome}</b><span>{(s.pesquisas || []).map((q) => `«${q}»`).join("  ")}</span></div>
        <span className="tg mn">{(s.pesquisas || []).length} pesquisas</span>
        <button className="btn icon" title="Editar" aria-label="Editar" onClick={() => setE({ ...s, pq: (s.pesquisas || []).join("\n") })}><Icon name="pencil-simple" /></button>
        <DangerBtn onConfirm={() => deleteDoc(doc(db, "sectors", s.id)).then(() => flash("Categoria removida")).catch((er) => flash(errMsg(er)))} />
      </div>))}</div>
    {list.length === 0 && <p className="hint">Ainda não há categorias. Corre o seed ou cria uma.</p>}
    {e && (
      <FormModal title={e._new ? "Nova categoria" : `Editar ${e.nome}`} onClose={() => setE(null)} onSave={save}>
        <div className="fgrid">
          <label className="fld"><span>Nome</span><input autoComplete="off" value={e.nome} onChange={(x) => setE({ ...e, nome: x.target.value })} /></label>
          <label className="fld"><span>Ordem</span><input type="number" min={1} value={e.ordem} onChange={(x) => setE({ ...e, ordem: +x.target.value })} /></label>
          <div className="fld wide"><span>Cor</span><div className="swatches">{AREA_COLORS.map((c) => (
            <button type="button" key={c} className="sw" aria-pressed={e.cor === c} style={{ background: c }} aria-label={c} onClick={() => setE({ ...e, cor: c })} />))}
            <input type="color" value={e.cor} onChange={(x) => setE({ ...e, cor: x.target.value.toUpperCase() })} aria-label="Outra cor" /></div></div>
          <div className="fld full"><span>Ícone</span><div className="icons">{CATEGORY_ICONS.map((n) => (
            <button type="button" key={n} className="ico" aria-pressed={e.icone === n} aria-label={n} onClick={() => setE({ ...e, icone: n })}><Icon name={n} size={18} /></button>))}</div></div>
          <label className="fld full"><span>Descrição para a Gemini</span><textarea rows={3} value={e.descricao} onChange={(x) => setE({ ...e, descricao: x.target.value })} placeholder="Que tipo de startup pertence a esta categoria." /></label>
          <label className="fld full"><span>Pesquisas online (uma por linha, PT ou EN)</span><textarea rows={6} value={e.pq} onChange={(x) => setE({ ...e, pq: x.target.value })} placeholder={"wine tech startup raises funding\nstartup tecnologia vinho Portugal"} /></label>
        </div>
        <p className="hint">Pesquisas concretas dão melhores resultados: junta o tipo de empresa, o tema e um sinal de novidade (ronda, lançamento, piloto).</p>
      </FormModal>
    )}
    {cfEl}
    {el}
  </>);
}
