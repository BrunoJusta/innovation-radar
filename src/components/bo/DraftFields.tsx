"use client";
import { useState } from "react";
import { Area, Category, Fonte } from "@/lib/types";
import { EditFields } from "@/lib/bo-actions";
import { relLabel } from "@/lib/util";
import { Gauge } from "./ui";
import { TagPicker } from "./TagPicker";

type V = EditFields & { destaque?: boolean; fonte?: Fonte };
const toDate = (iso: string) => (iso ? iso.slice(0, 10) : "");
const fromDate = (d: string, prev: string) => (d ? new Date(`${d}T${(prev || "").slice(11, 19) || "12:00:00"}Z`).toISOString() : prev);

/** Formulário de edição total de uma notícia (usado ao adicionar por link e no detalhe). */
export function DraftFields({ value: v, onChange, areas, cats, withSource = false }: {
  value: V; onChange: (p: Partial<V>) => void; areas: Area[]; cats: Category[]; withSource?: boolean;
}) {
  // Texto livre enquanto se escreve (senão a vírgula desaparecia ao separar)
  const [ents, setEnts] = useState((v.entidades || []).join(", "));
  return (
    <div className="dform">
      <label className="fld full"><span>Título</span>
        <input autoComplete="off" value={v.titulo} maxLength={140} onChange={(e) => onChange({ titulo: e.target.value })} /></label>

      <div className="fgrid">
        <label className="fld wide"><span>Cadeia de valor</span>
          <select value={v.area} onChange={(e) => onChange({ area: e.target.value })}>
            {!areas.some((a) => a.id === v.area) && <option value={v.area}>Escolhe a cadeia de valor</option>}
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
        <label className="fld"><span>Data de publicação</span>
          <input type="date" value={toDate(v.dataPublicacao)} onChange={(e) => onChange({ dataPublicacao: fromDate(e.target.value, v.dataPublicacao) })} /></label>
        <div className="fld"><span>Relevância</span>
          <div className="relin"><Gauge v={v.relevancia} />
            <input type="range" min={0} max={100} value={v.relevancia} aria-label="Relevância" onChange={(e) => onChange({ relevancia: +e.target.value })} />
            <b>{v.relevancia}</b><small>{relLabel(v.relevancia)}</small></div></div>
      </div>

      <div className="fld full"><span>Tags</span><TagPicker cats={cats} value={v.tags || []} onChange={(tags) => onChange({ tags })} /></div>

      <label className="fld full"><span>Resumo <em>(parágrafos separados por uma linha em branco; o primeiro é o lead)</em></span>
        <textarea rows={9} value={v.resumo} onChange={(e) => onChange({ resumo: e.target.value })} /></label>
      <label className="fld full"><span>Porque importa para a Sogrape <em>(só no backoffice)</em></span>
        <textarea rows={3} value={v.porque} onChange={(e) => onChange({ porque: e.target.value })} /></label>
      <label className="fld full"><span>Entidades referidas <em>(separadas por vírgulas)</em></span>
        <input autoComplete="off" value={ents} onChange={(e) => { setEnts(e.target.value); onChange({ entidades: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }); }} /></label>

      {withSource && v.fonte && (
        <fieldset className="srcf"><legend>Fonte</legend>
          <div className="fgrid">
            <label className="fld"><span>Site</span><input autoComplete="off" value={v.fonte.site} onChange={(e) => onChange({ fonte: { ...v.fonte!, site: e.target.value } })} /></label>
            <label className="fld wide"><span>Título original</span><input autoComplete="off" value={v.fonte.tituloOriginal} onChange={(e) => onChange({ fonte: { ...v.fonte!, tituloOriginal: e.target.value } })} /></label>
            <label className="fld"><span>Autor</span><input autoComplete="off" value={v.fonte.autor || ""} onChange={(e) => onChange({ fonte: { ...v.fonte!, autor: e.target.value || undefined } })} /></label>
          </div>
          <a className="srcl" href={v.fonte.url} target="_blank" rel="noopener noreferrer">{v.fonte.url}</a>
        </fieldset>
      )}
    </div>
  );
}
