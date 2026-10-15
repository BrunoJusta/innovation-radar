"use client";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AREA_COLORS, Sector } from "@/lib/types";
import { slug } from "@/lib/util";
import { CATEGORY_ICONS, Icon } from "@/components/Icon";
import { AdmHead, DangerBtn, errMsg, useFlash } from "./common";

type Edit = Omit<Sector, "pesquisas"> & { pq: string; _new?: boolean };

/** Setores das startups e as pesquisas online que a recolha semanal corre para cada um. */
export function SectorsView() {
  const [list, setList] = useState<Sector[]>([]);
  const [e, setE] = useState<Edit | null>(null);
  const { flash, el } = useFlash();
  useEffect(() => onSnapshot(query(collection(db, "sectors"), orderBy("ordem")), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Sector))), []);

  const save = async () => {
    if (!e || !e.nome.trim()) return flash("Indica o nome do setor.");
    const { _new, id, pq, ...rest } = e;
    const pesquisas = pq.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12);
    try { await setDoc(doc(db, "sectors", _new ? slug(e.nome) : id), { ...rest, pesquisas }, { merge: true }); setE(null); flash("Setor guardado"); }
    catch (er) { flash(errMsg(er)); }
  };

  return (<>
    <AdmHead title="Setores e pesquisas" text="Os setores são os anéis do radar de startups, pela ordem definida aqui. As pesquisas de cada setor correm todas as segundas na recolha semanal (cada pesquisa conta como uma pesquisa Google da Gemini).">
      <button className="btn primary" onClick={() => setE({ id: "", nome: "", cor: AREA_COLORS[list.length % AREA_COLORS.length], icone: "sparkle", descricao: "", ordem: list.length + 1, pq: "", _new: true })}><Icon name="plus" />Novo setor</button>
    </AdmHead>
    <div className="rows">{list.map((s) => (
      <div className="row" key={s.id}>
        <span className="cic" style={{ color: s.cor }}><Icon name={s.icone} size={18} /></span>
        <div className="rmain"><b>{s.nome}</b><span>{(s.pesquisas || []).map((q) => `«${q}»`).join("  ")}</span></div>
        <span className="tg mn">{(s.pesquisas || []).length} pesquisas</span>
        <button className="btn icon" title="Editar" aria-label="Editar" onClick={() => setE({ ...s, pq: (s.pesquisas || []).join("\n") })}><Icon name="pencil-simple" /></button>
        <DangerBtn onConfirm={() => deleteDoc(doc(db, "sectors", s.id)).then(() => flash("Setor removido")).catch((er) => flash(errMsg(er)))} />
      </div>))}</div>
    {list.length === 0 && <p className="hint">Ainda não há setores. Corre o seed ou cria um.</p>}
    {e && (
      <div className="form">
        <h3>{e._new ? "Novo setor" : `Editar ${e.nome}`}</h3>
        <div className="fgrid">
          <label className="fld"><span>Nome</span><input autoComplete="off" value={e.nome} onChange={(x) => setE({ ...e, nome: x.target.value })} /></label>
          <label className="fld"><span>Ordem</span><input type="number" min={1} value={e.ordem} onChange={(x) => setE({ ...e, ordem: +x.target.value })} /></label>
          <div className="fld wide"><span>Cor</span><div className="swatches">{AREA_COLORS.map((c) => (
            <button key={c} className="sw" aria-pressed={e.cor === c} style={{ background: c }} aria-label={c} onClick={() => setE({ ...e, cor: c })} />))}
            <input type="color" value={e.cor} onChange={(x) => setE({ ...e, cor: x.target.value.toUpperCase() })} aria-label="Outra cor" /></div></div>
          <div className="fld full"><span>Ícone</span><div className="icons">{CATEGORY_ICONS.map((n) => (
            <button key={n} className="ico" aria-pressed={e.icone === n} aria-label={n} onClick={() => setE({ ...e, icone: n })}><Icon name={n} size={18} /></button>))}</div></div>
          <label className="fld full"><span>Descrição para a Gemini</span><textarea rows={3} value={e.descricao} onChange={(x) => setE({ ...e, descricao: x.target.value })} placeholder="Que tipo de startup pertence a este setor." /></label>
          <label className="fld full"><span>Pesquisas online (uma por linha, PT ou EN)</span><textarea rows={6} value={e.pq} onChange={(x) => setE({ ...e, pq: x.target.value })} placeholder={"wine tech startup raises funding\nstartup tecnologia vinho Portugal"} /></label>
        </div>
        <p className="hint">Pesquisas concretas dão melhores resultados: junta o tipo de empresa, o tema e um sinal de novidade (ronda, lançamento, piloto).</p>
        <div className="factions"><button className="txtbtn" onClick={() => setE(null)}>Cancelar</button><button className="btn primary" onClick={save}><Icon name="check" />Guardar</button></div>
      </div>
    )}
    {el}
  </>);
}
