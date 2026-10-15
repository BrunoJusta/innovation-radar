"use client";
import { useState } from "react";
import { FASES, Sector } from "@/lib/types";
import { StartupEdit } from "@/lib/startup-actions";
import { relLabel } from "@/lib/util";
import { Gauge } from "../ui";

/** Edição total da ficha de uma startup. */
export function StartupFields({ value: v, onChange, sectors }: { value: StartupEdit; onChange: (p: Partial<StartupEdit>) => void; sectors: Sector[] }) {
  const [inv, setInv] = useState((v.investidores || []).join(", "));
  return (
    <div className="dform">
      <div className="fgrid">
        <label className="fld"><span>Nome</span><input autoComplete="off" value={v.nome} onChange={(e) => onChange({ nome: e.target.value })} /></label>
        <label className="fld"><span>Site</span><input autoComplete="off" type="url" spellCheck={false} value={v.site} onChange={(e) => onChange({ site: e.target.value })} /></label>
        <label className="fld"><span>Setor</span>
          <select value={v.setor} onChange={(e) => onChange({ setor: e.target.value })}>{sectors.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
        <label className="fld"><span>Fase</span>
          <select value={v.fase} onChange={(e) => onChange({ fase: e.target.value as StartupEdit["fase"] })}>{FASES.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
        <label className="fld"><span>País</span><input autoComplete="off" value={v.pais} onChange={(e) => onChange({ pais: e.target.value })} /></label>
        <label className="fld"><span>Cidade</span><input autoComplete="off" value={v.cidade || ""} onChange={(e) => onChange({ cidade: e.target.value })} /></label>
        <label className="fld"><span>Ano de fundação</span>
          <input type="number" min={1980} max={new Date().getFullYear()} value={v.fundacao ?? ""} onChange={(e) => onChange({ fundacao: e.target.value ? +e.target.value : null })} /></label>
        <div className="fld"><span>Relevância</span>
          <div className="relin"><Gauge v={v.relevancia} />
            <input type="range" min={0} max={100} value={v.relevancia} aria-label="Relevância" onChange={(e) => onChange({ relevancia: +e.target.value })} />
            <b>{v.relevancia}</b><small>{relLabel(v.relevancia)}</small></div></div>
      </div>
      <label className="fld full"><span>O que faz</span><textarea rows={4} value={v.descricao} onChange={(e) => onChange({ descricao: e.target.value })} /></label>
      <label className="fld full"><span>Porque interessa à Sogrape</span><textarea rows={3} value={v.porque} onChange={(e) => onChange({ porque: e.target.value })} /></label>
      <div className="fgrid">
        <label className="fld"><span>Financiamento <em>(ex.: 2,5 M€ seed, 2025)</em></span><input autoComplete="off" value={v.financiamento} onChange={(e) => onChange({ financiamento: e.target.value })} /></label>
        <label className="fld"><span>Investidores <em>(separados por vírgulas)</em></span>
          <input autoComplete="off" value={inv} onChange={(e) => { setInv(e.target.value); onChange({ investidores: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }); }} /></label>
      </div>
    </div>
  );
}
