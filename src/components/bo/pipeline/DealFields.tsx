"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Deal, FASES_DF, ORIGENS_DF, VERTICAIS_DF } from "@/lib/types";

export type DealEdit = Pick<Deal, "nome" | "site" | "fundadores" | "descricao" | "pais" | "vertical" | "fase" | "interesse" | "entrada" | "ronda" | "origem" | "documentos">;
export const pickDeal = (d: Omit<Deal, "id">): DealEdit => ({ nome: d.nome, site: d.site, fundadores: d.fundadores, descricao: d.descricao, pais: d.pais, vertical: d.vertical, fase: d.fase,
  interesse: d.interesse, entrada: d.entrada, ronda: { ...d.ronda, coinvestidores: [...(d.ronda?.coinvestidores || [])] }, origem: { ...d.origem }, documentos: [...(d.documentos || [])] });

/** Lê valores como "1,5 M", "350k", "€ 200 K" ou "2000000" (euros). */
export function parseEur(t: string): number | null {
  const s = t.trim().toLowerCase().replace(/€|eur|\s/g, "");
  if (!s) return null;
  const m = s.match(/^(\d+(?:[.,]\d+)?)(m|k|mil)?$/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Math.round(m[2] === "m" ? n * 1e6 : m[2] === "k" || m[2] === "mil" ? n * 1e3 : n);
}
export const fmtEur = (n: number | null | undefined) => n == null ? "" : n >= 1e6 ? `${(n / 1e6).toLocaleString("pt-PT", { maximumFractionDigits: 2 })} M€` : n >= 1e3 ? `${(n / 1e3).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} mil €` : `${n} €`;

function Eur({ label, v, on }: { label: string; v: number | null; on: (n: number | null) => void }) {
  const [t, setT] = useState(fmtEur(v));
  const bad = !!t.trim() && parseEur(t) === null;
  return <label className="fld"><span>{label}</span><input value={t} onChange={(e) => setT(e.target.value)} onBlur={() => { const n = parseEur(t); on(n); if (n !== null) setT(fmtEur(n)); }}
    placeholder="ex.: 1,5 M ou 350k" aria-invalid={bad} />{bad && <em className="ferr">Escreve um valor como 1,5 M ou 350k</em>}</label>;
}

/** Edição da ficha de uma startup no pipeline. */
export function DealFields({ value: v, onChange, origens }: { value: DealEdit; onChange: (p: Partial<DealEdit>) => void; origens: string[] }) {
  const [coinv, setCoinv] = useState(v.ronda.coinvestidores.join(", "));
  const r = (p: Partial<Deal["ronda"]>) => onChange({ ronda: { ...v.ronda, ...p } });
  return (
    <div className="dform">
      <div className="fgrid">
        <label className="fld"><span>Nome</span><input value={v.nome} onChange={(e) => onChange({ nome: e.target.value })} /></label>
        <label className="fld"><span>Site</span><input type="url" spellCheck={false} value={v.site} onChange={(e) => onChange({ site: e.target.value })} placeholder="https://" /></label>
        <label className="fld"><span>Fundadores</span><input value={v.fundadores} onChange={(e) => onChange({ fundadores: e.target.value })} /></label>
        <label className="fld"><span>País</span><input value={v.pais} onChange={(e) => onChange({ pais: e.target.value })} /></label>
        <label className="fld"><span>Vertical</span><select value={v.vertical} onChange={(e) => onChange({ vertical: e.target.value as DealEdit["vertical"] })}>
          <option value="">Por definir</option>{VERTICAIS_DF.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <label className="fld"><span>Fase</span><select value={v.fase} onChange={(e) => onChange({ fase: e.target.value as DealEdit["fase"] })}>
          <option value="">Por definir</option>{FASES_DF.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <label className="fld"><span>Interesse</span><select value={v.interesse} onChange={(e) => onChange({ interesse: e.target.value as DealEdit["interesse"] })}>
          <option value="investimento">Possível investimento</option><option value="outro">Outra relação (piloto, parceria)</option></select></label>
        <label className="fld"><span>Data de entrada</span><input type="date" value={v.entrada} onChange={(e) => onChange({ entrada: e.target.value })} /></label>
      </div>
      <label className="fld full"><span>Descrição</span><textarea rows={3} value={v.descricao} onChange={(e) => onChange({ descricao: e.target.value })} /></label>

      <h5 className="fsec">Origem</h5>
      <div className="fgrid">
        <label className="fld"><span>Tipo</span><select value={v.origem.tipo} onChange={(e) => onChange({ origem: { ...v.origem, tipo: e.target.value as Deal["origem"]["tipo"] } })}>
          {ORIGENS_DF.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <label className="fld"><span>Qual <em>(evento, parceiro…)</em></span><input list="df-origens" value={v.origem.nome} onChange={(e) => onChange({ origem: { ...v.origem, nome: e.target.value } })} />
          <datalist id="df-origens">{origens.map((o) => <option key={o} value={o} />)}</datalist></label>
        <label className="fld"><span>Contacto que apresentou</span><input value={v.origem.contacto} onChange={(e) => onChange({ origem: { ...v.origem, contacto: e.target.value } })} /></label>
      </div>

      <h5 className="fsec">Ronda</h5>
      <div className="fgrid">
        <Eur label="Valuation" v={v.ronda.valuation} on={(n) => r({ valuation: n })} />
        <Eur label="Tamanho da ronda" v={v.ronda.valor} on={(n) => r({ valor: n })} />
        <Eur label="Ticket da Sogrape" v={v.ronda.ticket} on={(n) => r({ ticket: n })} />
        <label className="fld"><span>Lead investor</span><input value={v.ronda.lead} onChange={(e) => r({ lead: e.target.value })} /></label>
        <label className="fld wide"><span>Coinvestidores <em>(separados por vírgulas)</em></span>
          <input value={coinv} onChange={(e) => { setCoinv(e.target.value); r({ coinvestidores: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }); }} /></label>
      </div>
      <label className="fld full"><span>Notas da ronda</span><input value={v.ronda.notas} onChange={(e) => r({ notas: e.target.value })} placeholder="ex.: $3,5 M; 3 M€ assegurados por fundos" /></label>

      <h5 className="fsec">Documentos</h5>
      <div className="docs-ed">
        {v.documentos.map((d, i) => (
          <div key={i} className="doc-row">
            <input value={d.titulo} placeholder="Título (deck, business plan…)" onChange={(e) => onChange({ documentos: v.documentos.map((x, k) => k === i ? { ...x, titulo: e.target.value } : x) })} />
            <input value={d.url} placeholder="Link (Pasta Partilhada, SharePoint…)" type="url" spellCheck={false} onChange={(e) => onChange({ documentos: v.documentos.map((x, k) => k === i ? { ...x, url: e.target.value } : x) })} />
            <button type="button" className="btn icon" aria-label="Remover documento" onClick={() => onChange({ documentos: v.documentos.filter((_, k) => k !== i) })}><Icon name="trash" /></button>
          </div>
        ))}
        <button type="button" className="txtbtn" onClick={() => onChange({ documentos: [...v.documentos, { titulo: "", url: "" }] })}><Icon name="plus" />Adicionar documento</button>
      </div>
    </div>
  );
}
