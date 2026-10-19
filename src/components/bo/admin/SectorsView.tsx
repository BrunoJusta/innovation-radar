"use client";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { post } from "@/lib/api";
import { CATEGORIAS_LISTA } from "@/lib/categorias";
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

  // Passagem para as categorias por tipo de solução: troca as categorias e reclassifica as startups com a Gemini
  const [migr, setMigr] = useState<{ feitas: number; total: number } | null>(null);
  const antigas = list.length > 0 && !list.every((x) => CATEGORIAS_LISTA.some((c) => c.id === x.id));
  const instalar = async (soReclassificar = false) => {
    try {
      if (!soReclassificar) {
        for (const x of list.filter((x) => !CATEGORIAS_LISTA.some((c) => c.id === x.id))) await deleteDoc(doc(db, "sectors", x.id));
        for (const { id, ...c } of CATEGORIAS_LISTA) await setDoc(doc(db, "sectors", id), c);
      }
      const cats = CATEGORIAS_LISTA.map(({ id, nome, descricao }) => ({ id, nome, descricao }));
      const ok = new Set(cats.map((c) => c.id));
      const st = (await getDocs(collection(db, "startups"))).docs.map((d) => ({ id: d.id, ...d.data() }) as { id: string; nome: string; descricao: string; setor: string; status: string })
        .filter((x) => x.status !== "rejected" && (!soReclassificar || !ok.has(x.setor)));
      setMigr({ feitas: 0, total: st.length });
      let feitas = 0;
      for (let i = 0; i < st.length; i += 80) {
        const lote = st.slice(i, i + 80).map((x) => ({ id: x.id, nome: x.nome, descricao: x.descricao }));
        const j = await post<{ setores: Record<string, string> }>("/api/startups/setores", { startups: lote, sectors: cats });
        await Promise.all(Object.entries(j.setores).map(([id, setor]) => updateDoc(doc(db, "startups", id), { setor })));
        feitas += lote.length; setMigr({ feitas, total: st.length });
      }
      flash(`Categorias instaladas e ${st.length} startups reclassificadas`);
    } catch (er) { flash(errMsg(er)); }
    setMigr(null);
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
      <button className="btn primary" onClick={() => setE({ id: "", nome: "", cor: AREA_COLORS[list.length % AREA_COLORS.length], icone: "sparkle", descricao: "", ordem: list.length + 1, pq: "", _new: true })}><Icon name="plus" />Nova categoria</button>
    </AdmHead>
    {(antigas || migr) && (
      <div className="notice warn scad"><span>{migr ? `A reclassificar as startups com a Gemini: ${migr.feitas} de ${migr.total}…` : "Estes são os setores antigos. Instala as 8 categorias por tipo de solução: os setores antigos são apagados e a Gemini atribui uma categoria a cada startup."}</span>
        {!migr && <button className="btn primary" onClick={() => instalar()}><Icon name="sparkle" />Instalar categorias e reclassificar</button>}</div>
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
    {el}
  </>);
}
