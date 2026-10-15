"use client";
import { useEffect, useState } from "react";
import { collection, deleteDoc, deleteField, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SOURCE_GROUPS, Source } from "@/lib/types";
import { fdLongo, slug } from "@/lib/util";
import { Icon } from "@/components/Icon";
import { AdmHead, DangerBtn, Toggle, errMsg, useFlash } from "./common";

const BLANK: Omit<Source, "id"> = { nome: "", tipo: "rss", url: "", lingua: "en", ativo: true };
const SEM_GRUPO = "Sem grupo";
const usoDe = (s: Source) => s.para || "noticias";

/** Fontes de notícias (recolha diária) ou de startups (recolha semanal); vivem na mesma coleção, separadas pelo campo `para`. */
export function SourcesView({ para = "noticias" }: { para?: "noticias" | "startups" }) {
  const news = para === "noticias";
  const [all, setList] = useState<Source[]>([]);
  const list = all.filter((s) => usoDe(s) === para);
  const grupos = news ? Array.from(new Set([...SOURCE_GROUPS, ...list.map((s) => s.grupo || "").filter(Boolean)])) : [];
  const blocks = news
    ? [...grupos, SEM_GRUPO].map((g) => ({ g, items: list.filter((s) => (s.grupo || SEM_GRUPO) === g) })).filter((b) => b.items.length)
    : [{ g: "", items: list }];
  const [edit, setEdit] = useState<Source | null>(null);
  const [isNew, setIsNew] = useState(false);
  const { flash, el } = useFlash();
  useEffect(() => onSnapshot(collection(db, "sources"), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Source).sort((a, b) => a.nome.localeCompare(b.nome)))), []);

  const save = async () => {
    if (!edit) return;
    const { id, ...data } = edit;
    if (!data.nome.trim() || !/^https?:\/\//.test(data.url)) { flash("Indica um nome e um URL que comece por http."); return; }
    try {
      const key = isNew ? (all.some((x) => x.id === slug(data.nome)) ? `${slug(data.nome)}-${para}` : slug(data.nome)) : id;
      if (para === "startups") data.para = "startups"; else delete data.para;
      if (!data.grupo) delete data.grupo;
      const urlMudou = !isNew && edit.bloqueado && edit.bloqueado.url !== data.url;
      await setDoc(doc(db, "sources", key), urlMudou ? { ...data, bloqueado: deleteField() } : data, { merge: true });
      setEdit(null); flash(isNew ? "Fonte adicionada" : "Fonte atualizada");
    } catch (e) { flash(errMsg(e)); }
  };

  return (<>
    <AdmHead title={news ? "Fontes das notícias" : "Fontes das startups"}
      text={news ? "Sites de onde a recolha diária lê notícias. Desligar uma fonte não apaga o que já foi recolhido."
        : "Feeds de notícias sobre startups e investimento. A recolha semanal lê os artigos da semana, identifica as startups citadas e faz a ficha de cada uma."}>
      <button className="btn primary" onClick={() => { setIsNew(true); setEdit({ id: "", ...BLANK }); }}><Icon name="plus" />Nova fonte</button>
    </AdmHead>
    {blocks.map(({ g, items }) => (
    <div className="srcgrp" key={g || "all"}>
    {g && <h3 className="srcg">{g}<span>{items.length}</span></h3>}
    <div className="rows">
      {items.map((s) => (
        <div className="row" key={s.id}>
          <Toggle on={s.ativo} label={`Ativar ${s.nome}`} onChange={(v) => updateDoc(doc(db, "sources", s.id), v ? { ativo: true, bloqueado: deleteField() } : { ativo: false }).then(() => v && s.bloqueado && flash("Fonte ligada. Se o site continuar a bloquear, volta a ser desligada na próxima recolha.")).catch((e) => flash(errMsg(e)))} />
          <div className="rmain"><b>{s.nome}</b><span className="mtxt">{s.url}</span>
            {s.bloqueado && <span className="blk-why">O site bloqueia a recolha (Cloudflare, HTTP {s.bloqueado.http}) desde {fdLongo(s.bloqueado.em)}. Foi desligada automaticamente. Para notícias deste site usa Adicionar › Colar o texto do artigo.</span>}</div>
          {s.bloqueado && <span className="tg no" title={`Bloqueada pela Cloudflare em ${fdLongo(s.bloqueado.em)}`}><Icon name="prohibit" />Bloqueado</span>}
          <span className="tg">{s.tipo === "rss" ? "RSS" : "WordPress API"}</span>
          <span className="tg">{s.lingua.toUpperCase()}</span>
          <button className="btn icon" title="Editar" aria-label="Editar" onClick={() => { setIsNew(false); setEdit(s); }}><Icon name="pencil-simple" /></button>
          <DangerBtn onConfirm={() => deleteDoc(doc(db, "sources", s.id)).then(() => flash("Fonte removida")).catch((e) => flash(errMsg(e)))} />
        </div>
      ))}
    </div>
    </div>
    ))}
    {list.length === 0 && <div className="rows"><p className="hint">Ainda não há fontes. Corre o seed ou adiciona uma.</p></div>}
    {edit && (
      <div className="form">
        <h3>{isNew ? "Nova fonte" : `Editar ${edit.nome}`}</h3>
        <div className="fgrid">
          <label className="fld"><span>Nome</span><input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="BeverageDaily" /></label>
          <label className="fld wide"><span>URL do feed</span><input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://site.com/feed/" type="url" spellCheck={false} autoComplete="off" /></label>
          <label className="fld"><span>Tipo</span><select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value as Source["tipo"] })}><option value="rss">RSS</option><option value="wp-api">WordPress API</option></select></label>
          <label className="fld"><span>Língua</span><select value={edit.lingua} onChange={(e) => setEdit({ ...edit, lingua: e.target.value as Source["lingua"] })}><option value="pt">Português</option><option value="en">Inglês</option></select></label>
          {news && <label className="fld wide"><span>Grupo</span><input value={edit.grupo || ""} list="src-grupos" onChange={(e) => setEdit({ ...edit, grupo: e.target.value })} placeholder="Escolhe ou escreve um grupo" />
            <datalist id="src-grupos">{grupos.map((g) => <option key={g} value={g} />)}</datalist></label>}
        </div>
        <p className="hint">{edit.tipo === "rss" ? "O endereço do feed RSS, normalmente termina em /feed/ ou /rss." : "O endereço base do site WordPress (a recolha usa /wp-json/wp/v2/posts) ou o endereço completo da API com filtros, por exemplo …/wp-json/wp/v2/posts?categories=772."}</p>
        <div className="factions"><button className="txtbtn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" onClick={save}><Icon name="check" />Guardar</button></div>
      </div>
    )}
    {el}
  </>);
}
