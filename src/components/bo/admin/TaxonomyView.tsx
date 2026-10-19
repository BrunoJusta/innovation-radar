"use client";
import { useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AREA_COLORS, Area, Category, TIPOS_TAG, TipoTag, tipoDe } from "@/lib/types";
import { slug } from "@/lib/util";
import { PALETA_CADEIAS } from "@/lib/taxonomia";
import { CATEGORY_ICONS, Icon } from "@/components/Icon";
import { AdmHead, DangerBtn, errMsg, FormModal, useFlash } from "./common";

type AEdit = Area & { _new?: boolean };
type CEdit = Omit<Category, "palavrasChave"> & { kw: string; _new?: boolean };

/** Cadeias de valor (parte = "areas", página geral) ou tags das notícias (parte = "tags"). */
export function TaxonomyView({ areas, cats, parte }: { areas: Area[]; cats: Category[]; parte: "areas" | "tags" }) {
  const [ae, setAe] = useState<AEdit | null>(null);
  const [ce, setCe] = useState<CEdit | null>(null);
  const { flash, el } = useFlash();

  const saveArea = async () => {
    if (!ae || !ae.nome.trim()) return flash("Indica o nome da cadeia de valor.");
    const { _new, id, ...data } = ae;
    try { await setDoc(doc(db, "areas", _new ? slug(ae.nome) : id), data, { merge: true }); setAe(null); flash("Cadeia de valor guardada"); }
    catch (e) { flash(errMsg(e)); }
  };
  const saveCat = async () => {
    if (!ce || !ce.nome.trim()) return flash("Indica o nome da tag.");
    const { _new, id, kw, ...rest } = ce;
    const palavrasChave = kw.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean);
    try { await setDoc(doc(db, "categories", _new ? slug(ce.nome) : id), { ...rest, tipo: rest.tipo || "tematica", area: null, palavrasChave }, { merge: true }); setCe(null); flash("Tag guardada"); }
    catch (e) { flash(errMsg(e)); }
  };

  return (<>
    {parte === "areas"
      ? <AdmHead title="Cadeias de valor" text="As cadeias de valor são os anéis dos dois radares, o das notícias e o das startups: cada notícia e cada startup tem uma. A Gemini usa o nome e a descrição para classificar, e a ordem decide o anel (1 = centro)." />
      : <AdmHead title="Tags" text="As tags das notícias dividem-se em temáticas, tecnologias e canais: cada notícia tem pelo menos uma temática, e as tecnologias e os canais que se aplicarem. As palavras-chave decidem que artigos chegam à Gemini." />}

    {parte === "areas" && <section className="adm-sec">
      <div className="gh"><h2>Cadeias de valor</h2><span>{areas.length}</span><span className="sp" />
        {areas.some((a) => PALETA_CADEIAS[a.id] && PALETA_CADEIAS[a.id] !== a.cor) && <button className="btn" onClick={() => Promise.all(areas.filter((a) => PALETA_CADEIAS[a.id]).map((a) => setDoc(doc(db, "areas", a.id), { cor: PALETA_CADEIAS[a.id] }, { merge: true }))).then(() => flash("Paleta Sogrape aplicada")).catch((e) => flash(errMsg(e)))}><Icon name="sparkle" />Aplicar paleta Sogrape</button>}
        <button className="btn" onClick={() => setAe({ id: "", nome: "", descricao: "", cor: AREA_COLORS[areas.length % AREA_COLORS.length], ordem: areas.length + 1, _new: true })}><Icon name="plus" />Nova cadeia de valor</button></div>
      <div className="rows">{areas.map((a) => (
        <div className="row" key={a.id}>
          <span className="dot" style={{ background: a.cor }} />
          <div className="rmain"><b>{a.nome}</b><span>{a.descricao || "Sem descrição"}</span></div>
          <span className="tg mn">Anel {a.ordem}</span>
          <button className="btn icon" title="Editar" aria-label="Editar" onClick={() => setAe(a)}><Icon name="pencil-simple" /></button>
          <DangerBtn onConfirm={() => deleteDoc(doc(db, "areas", a.id)).then(() => flash("Cadeia de valor removida")).catch((e) => flash(errMsg(e)))} />
        </div>))}</div>
      {ae && (
        <FormModal title={ae._new ? "Nova cadeia de valor" : `Editar ${ae.nome}`} onClose={() => setAe(null)} onSave={saveArea}>
          <div className="fgrid">
            <label className="fld"><span>Nome</span><input autoComplete="off" value={ae.nome} onChange={(e) => setAe({ ...ae, nome: e.target.value })} /></label>
            <label className="fld"><span>Ordem (anel, 1 = centro)</span><input type="number" min={1} value={ae.ordem} onChange={(e) => setAe({ ...ae, ordem: +e.target.value })} /></label>
            <div className="fld wide"><span>Cor</span><div className="swatches">{[...new Set([...Object.values(PALETA_CADEIAS), ...AREA_COLORS])].map((c) => (
              <button type="button" key={c} className="sw" aria-pressed={ae.cor === c} style={{ background: c }} aria-label={c} onClick={() => setAe({ ...ae, cor: c })} />))}
              <input type="color" value={ae.cor} onChange={(e) => setAe({ ...ae, cor: e.target.value.toUpperCase() })} aria-label="Outra cor" /></div></div>
            <label className="fld full"><span>Descrição para a Gemini</span><textarea rows={3} value={ae.descricao} onChange={(e) => setAe({ ...ae, descricao: e.target.value })} placeholder="Que notícias e que startups pertencem a esta cadeia de valor." /></label>
          </div>
        </FormModal>)}
    </section>}

    {parte === "tags" && TIPOS_TAG.map((tp) => { const l = cats.filter((c) => tipoDe(c) === tp.id).sort((a, b) => a.ordem - b.ordem); return (
    <section className="adm-sec" key={tp.id}>
      <div className="gh"><h2>{tp.plural}</h2><span>{l.length}</span><span className="sp" />
        <button type="button" className="btn" onClick={() => setCe({ id: "", nome: "", icone: "sparkle", descricao: "", ordem: l.length + 1, kw: "", tipo: tp.id, _new: true })}><Icon name="plus" />Nova {tp.nome.toLowerCase()}</button></div>
      {l.length ? <div className="rows">{l.map((c) => (
        <div className="row" key={c.id}>
          <span className="cic"><Icon name={c.icone} size={18} /></span>
          <div className="rmain"><b>{c.nome}</b><span>{c.descricao || (c.palavrasChave || []).slice(0, 8).join(", ")}</span></div>
          <span className="tg mn">{(c.palavrasChave || []).length} palavras</span>
          <button type="button" className="btn icon" title="Editar" aria-label="Editar" onClick={() => setCe({ ...c, tipo: tipoDe(c), kw: (c.palavrasChave || []).join(", ") })}><Icon name="pencil-simple" /></button>
          <DangerBtn onConfirm={() => deleteDoc(doc(db, "categories", c.id)).then(() => flash(`${tp.nome} removida`)).catch((e) => flash(errMsg(e)))} />
        </div>))}</div> : <p className="hint">Ainda não há {tp.plural.toLowerCase()}.</p>}
    </section>); })}
    {ce && (
      <FormModal title={ce._new ? `Nova ${TIPOS_TAG.find((x) => x.id === ce.tipo)?.nome.toLowerCase() || "tag"}` : `Editar ${ce.nome}`} onClose={() => setCe(null)} onSave={saveCat}>
        <div className="fgrid">
          <label className="fld"><span>Nome</span><input autoComplete="off" value={ce.nome} onChange={(e) => setCe({ ...ce, nome: e.target.value })} /></label>
          <label className="fld"><span>Tipo</span>
            <select value={ce.tipo || "tematica"} onChange={(e) => setCe({ ...ce, tipo: e.target.value as TipoTag })}>
              {TIPOS_TAG.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select></label>
          <label className="fld"><span>Ordem</span><input type="number" min={1} value={ce.ordem} onChange={(e) => setCe({ ...ce, ordem: +e.target.value })} /></label>
          <div className="fld wide"><span>Ícone</span><div className="icons">{CATEGORY_ICONS.map((n) => (
            <button type="button" key={n} className="ico" aria-pressed={ce.icone === n} aria-label={n} onClick={() => setCe({ ...ce, icone: n })}><Icon name={n} size={18} /></button>))}</div></div>
          <label className="fld full"><span>Descrição para a Gemini</span><textarea rows={3} value={ce.descricao} onChange={(e) => setCe({ ...ce, descricao: e.target.value })} placeholder="O que entra nesta tag (ex.: novos formatos de embalagem, smart packaging, novos materiais)." /></label>
          <label className="fld full"><span>Palavras-chave (PT e EN, separadas por vírgulas)</span><textarea rows={4} value={ce.kw} onChange={(e) => setCe({ ...ce, kw: e.target.value })} placeholder="embalagem, packaging, garrafa, bottle" /></label>
        </div>
        <p className="hint">Um artigo só vai para a Gemini se o título ou o texto tiver pelo menos uma palavra-chave de alguma tag.</p>
      </FormModal>)}
    {el}
  </>);
}
