"use client";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Source } from "@/lib/types";
import { slug } from "@/lib/util";
import { Icon } from "@/components/Icon";
import { AdmHead, DangerBtn, Toggle, errMsg, useFlash } from "./common";

const BLANK: Omit<Source, "id"> = { nome: "", tipo: "rss", url: "", lingua: "en", ativo: true };

export function SourcesView() {
  const [list, setList] = useState<Source[]>([]);
  const [edit, setEdit] = useState<Source | null>(null);
  const [isNew, setIsNew] = useState(false);
  const { flash, el } = useFlash();
  useEffect(() => onSnapshot(collection(db, "sources"), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Source).sort((a, b) => a.nome.localeCompare(b.nome)))), []);

  const save = async () => {
    if (!edit) return;
    const { id, ...data } = edit;
    if (!data.nome.trim() || !/^https?:\/\//.test(data.url)) { flash("Indica um nome e um URL que comece por http."); return; }
    try {
      const key = isNew ? slug(data.nome) : id;
      await setDoc(doc(db, "sources", key), data, { merge: true });
      setEdit(null); flash(isNew ? "Fonte adicionada" : "Fonte atualizada");
    } catch (e) { flash(errMsg(e)); }
  };

  return (<>
    <AdmHead title="Fontes" text="Sites de onde a recolha diária lê notícias. Desligar uma fonte não apaga o que já foi recolhido.">
      <button className="btn primary" onClick={() => { setIsNew(true); setEdit({ id: "", ...BLANK }); }}><Icon name="plus" />Nova fonte</button>
    </AdmHead>
    <div className="rows">
      {list.map((s) => (
        <div className="row" key={s.id}>
          <Toggle on={s.ativo} label={`Ativar ${s.nome}`} onChange={(v) => updateDoc(doc(db, "sources", s.id), { ativo: v }).catch((e) => flash(errMsg(e)))} />
          <div className="rmain"><b>{s.nome}</b><span className="mtxt">{s.url}</span></div>
          <span className="tg">{s.tipo === "rss" ? "RSS" : "WordPress API"}</span>
          <span className="tg">{s.lingua.toUpperCase()}</span>
          <button className="btn icon" title="Editar" aria-label="Editar" onClick={() => { setIsNew(false); setEdit(s); }}><Icon name="pencil-simple" /></button>
          <DangerBtn onConfirm={() => deleteDoc(doc(db, "sources", s.id)).then(() => flash("Fonte removida")).catch((e) => flash(errMsg(e)))} />
        </div>
      ))}
      {list.length === 0 && <p className="hint">Ainda não há fontes. Corre o seed ou adiciona uma.</p>}
    </div>
    {edit && (
      <div className="form">
        <h3>{isNew ? "Nova fonte" : `Editar ${edit.nome}`}</h3>
        <div className="fgrid">
          <label className="fld"><span>Nome</span><input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="BeverageDaily" /></label>
          <label className="fld wide"><span>URL do feed</span><input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://site.com/feed/" type="url" spellCheck={false} autoComplete="off" /></label>
          <label className="fld"><span>Tipo</span><select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value as Source["tipo"] })}><option value="rss">RSS</option><option value="wp-api">WordPress API</option></select></label>
          <label className="fld"><span>Língua</span><select value={edit.lingua} onChange={(e) => setEdit({ ...edit, lingua: e.target.value as Source["lingua"] })}><option value="pt">Português</option><option value="en">Inglês</option></select></label>
        </div>
        <p className="hint">{edit.tipo === "rss" ? "O endereço do feed RSS, normalmente termina em /feed/ ou /rss." : "O endereço base do site WordPress; a recolha usa /wp-json/wp/v2/posts."}</p>
        <div className="factions"><button className="txtbtn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" onClick={save}><Icon name="check" />Guardar</button></div>
      </div>
    )}
    {el}
  </>);
}
