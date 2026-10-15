"use client";
import { useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AREA_COLORS, Area, Category } from "@/lib/types";
import { slug } from "@/lib/util";
import { CATEGORY_ICONS, Icon } from "@/components/Icon";
import { AdmHead, DangerBtn, errMsg, useFlash } from "./common";

type AEdit = Area & { _new?: boolean };
type CEdit = Omit<Category, "palavrasChave"> & { kw: string; _new?: boolean };

export function TaxonomyView({ areas, cats }: { areas: Area[]; cats: Category[] }) {
  const [ae, setAe] = useState<AEdit | null>(null);
  const [ce, setCe] = useState<CEdit | null>(null);
  const { flash, el } = useFlash();

  const saveArea = async () => {
    if (!ae || !ae.nome.trim()) return flash("Indica o nome da área.");
    const { _new, id, ...data } = ae;
    try { await setDoc(doc(db, "areas", _new ? slug(ae.nome) : id), data, { merge: true }); setAe(null); flash("Área guardada"); }
    catch (e) { flash(errMsg(e)); }
  };
  const saveCat = async () => {
    if (!ce || !ce.nome.trim()) return flash("Indica o nome da categoria.");
    const { _new, id, kw, ...rest } = ce;
    const palavrasChave = kw.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean);
    try { await setDoc(doc(db, "categories", _new ? slug(ce.nome) : id), { ...rest, palavrasChave }, { merge: true }); setCe(null); flash("Categoria guardada"); }
    catch (e) { flash(errMsg(e)); }
  };

  return (<>
    <AdmHead title="Áreas e categorias" text="As áreas são os anéis do radar. As categorias são os temas acompanhados e valem para todas as áreas; as palavras-chave decidem que artigos chegam à Gemini." />

    <section className="adm-sec">
      <div className="gh"><h2>Áreas</h2><span>{areas.length}</span><span className="sp" />
        <button className="btn" onClick={() => setAe({ id: "", nome: "", descricao: "", cor: AREA_COLORS[areas.length % AREA_COLORS.length], ordem: areas.length + 1, _new: true })}><Icon name="plus" />Nova área</button></div>
      <div className="rows">{areas.map((a) => (
        <div className="row" key={a.id}>
          <span className="dot" style={{ background: a.cor }} />
          <div className="rmain"><b>{a.nome}</b><span>{a.descricao || "Sem descrição"}</span></div>
          <span className="tg mn">Anel {a.ordem}</span>
          <button className="btn icon" title="Editar" aria-label="Editar" onClick={() => setAe(a)}><Icon name="pencil-simple" /></button>
          <DangerBtn onConfirm={() => deleteDoc(doc(db, "areas", a.id)).then(() => flash("Área removida")).catch((e) => flash(errMsg(e)))} />
        </div>))}</div>
      {ae && (
        <div className="form">
          <h3>{ae._new ? "Nova área" : `Editar ${ae.nome}`}</h3>
          <div className="fgrid">
            <label className="fld"><span>Nome</span><input value={ae.nome} onChange={(e) => setAe({ ...ae, nome: e.target.value })} /></label>
            <label className="fld"><span>Ordem (anel, 1 = centro)</span><input type="number" min={1} value={ae.ordem} onChange={(e) => setAe({ ...ae, ordem: +e.target.value })} /></label>
            <div className="fld wide"><span>Cor</span><div className="swatches">{AREA_COLORS.map((c) => (
              <button key={c} className="sw" aria-pressed={ae.cor === c} style={{ background: c }} aria-label={c} onClick={() => setAe({ ...ae, cor: c })} />))}
              <input type="color" value={ae.cor} onChange={(e) => setAe({ ...ae, cor: e.target.value.toUpperCase() })} aria-label="Outra cor" /></div></div>
            <label className="fld full"><span>Descrição para a Gemini</span><textarea rows={3} value={ae.descricao} onChange={(e) => setAe({ ...ae, descricao: e.target.value })} placeholder="Que tipo de notícia pertence a esta área." /></label>
          </div>
          <div className="factions"><button className="txtbtn" onClick={() => setAe(null)}>Cancelar</button><button className="btn primary" onClick={saveArea}><Icon name="check" />Guardar</button></div>
        </div>)}
    </section>

    <section className="adm-sec">
      <div className="gh"><h2>Categorias</h2><span>{cats.length}</span><span className="sp" />
        <button className="btn" onClick={() => setCe({ id: "", nome: "", icone: "sparkle", descricao: "", ordem: cats.length + 1, kw: "", _new: true })}><Icon name="plus" />Nova categoria</button></div>
      <div className="rows">{cats.map((c) => (
        <div className="row" key={c.id}>
          <span className="cic"><Icon name={c.icone} size={18} /></span>
          <div className="rmain"><b>{c.nome}</b><span>{(c.palavrasChave || []).slice(0, 8).join(", ")}{(c.palavrasChave || []).length > 8 ? "…" : ""}</span></div>
          <span className="tg mn">{(c.palavrasChave || []).length} palavras</span>
          <button className="btn icon" title="Editar" aria-label="Editar" onClick={() => setCe({ ...c, kw: (c.palavrasChave || []).join(", ") })}><Icon name="pencil-simple" /></button>
          <DangerBtn onConfirm={() => deleteDoc(doc(db, "categories", c.id)).then(() => flash("Categoria removida")).catch((e) => flash(errMsg(e)))} />
        </div>))}</div>
      {ce && (
        <div className="form">
          <h3>{ce._new ? "Nova categoria" : `Editar ${ce.nome}`}</h3>
          <div className="fgrid">
            <label className="fld"><span>Nome</span><input value={ce.nome} onChange={(e) => setCe({ ...ce, nome: e.target.value })} /></label>
            <label className="fld"><span>Ordem</span><input type="number" min={1} value={ce.ordem} onChange={(e) => setCe({ ...ce, ordem: +e.target.value })} /></label>
            <div className="fld wide"><span>Ícone</span><div className="icons">{CATEGORY_ICONS.map((n) => (
              <button key={n} className="ico" aria-pressed={ce.icone === n} aria-label={n} onClick={() => setCe({ ...ce, icone: n })}><Icon name={n} size={18} /></button>))}</div></div>
            <label className="fld full"><span>Descrição para a Gemini</span><textarea rows={3} value={ce.descricao} onChange={(e) => setCe({ ...ce, descricao: e.target.value })} /></label>
            <label className="fld full"><span>Palavras-chave (PT e EN, separadas por vírgulas)</span><textarea rows={4} value={ce.kw} onChange={(e) => setCe({ ...ce, kw: e.target.value })} placeholder="sem álcool, non-alcoholic, alcohol-free, 0.0" /></label>
          </div>
          <p className="hint">Um artigo só vai para a Gemini se o título ou o texto tiver pelo menos uma palavra-chave de alguma categoria.</p>
          <div className="factions"><button className="txtbtn" onClick={() => setCe(null)}>Cancelar</button><button className="btn primary" onClick={saveCat}><Icon name="check" />Guardar</button></div>
        </div>)}
    </section>
    {el}
  </>);
}
