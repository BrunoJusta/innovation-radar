"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { AnalisePerfil, CICLOS, VERTICAIS } from "@/lib/types";
import { parseEur, fmtEur } from "../pipeline/DealFields";

/**
 * Todos os dados do perfil da análise, editáveis. Ao refazer, a avaliação usa estes dados em vez de voltar a pesquisar na web.
 */
export function PerfilEditor({ v, onChange }: { v: AnalisePerfil; onChange: (p: AnalisePerfil) => void }) {
  const set = (p: Partial<AnalisePerfil>) => onChange({ ...v, ...p });
  const tr = (p: Partial<AnalisePerfil["tracao"]>) => set({ tracao: { ...v.tracao, ...p } });
  const fin = (p: Partial<AnalisePerfil["financiamento"]>) => set({ financiamento: { ...v.financiamento, ...p } });
  const T = (k: keyof AnalisePerfil, label: string, rows = 2) => (
    <label className="fld full"><span>{label}</span><textarea rows={rows} value={String(v[k] ?? "")} onChange={(e) => set({ [k]: e.target.value } as Partial<AnalisePerfil>)} /></label>
  );
  return (
    <div className="dform pfed">
      <h5 className="fsec">Resumo</h5>
      {T("resumo", "Resumo", 3)}
      <h5 className="fsec">Identificação</h5>
      <div className="fgrid">
        <label className="fld"><span>Vertical</span><select value={v.vertical} onChange={(e) => set({ vertical: e.target.value as AnalisePerfil["vertical"] })}>
          {VERTICAIS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <label className="fld"><span>Ciclo de vida</span><select value={v.ciclo} onChange={(e) => set({ ciclo: e.target.value as AnalisePerfil["ciclo"] })}>
          {CICLOS.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.desc ? ` (${x.desc})` : ""}</option>)}</select></label>
        <label className="fld"><span>Fundação</span><input value={v.fundacao} onChange={(e) => set({ fundacao: e.target.value })} /></label>
        <label className="fld"><span>Sede</span><input value={v.sede} onChange={(e) => set({ sede: e.target.value })} /></label>
        <label className="fld wide"><span>Mercados</span><input value={v.mercados} onChange={(e) => set({ mercados: e.target.value })} /></label>
      </div>
      <h5 className="fsec">Produto e negócio</h5>
      {T("produto", "Produto")}{T("clientesAlvo", "Clientes-alvo")}{T("modeloNegocio", "Modelo de negócio")}{T("tecnologia", "Tecnologia")}{T("cadeiaValor", "Cadeia de valor do vinho")}
      <h5 className="fsec">Tração</h5>
      <label className="fld full"><span>Receita</span><textarea rows={2} value={v.tracao.receita} onChange={(e) => tr({ receita: e.target.value })} /></label>
      <label className="fld full"><span>Clientes</span><textarea rows={2} value={v.tracao.clientes} onChange={(e) => tr({ clientes: e.target.value })} /></label>
      <label className="fld full"><span>Pilotos</span><textarea rows={2} value={v.tracao.pilotos} onChange={(e) => tr({ pilotos: e.target.value })} /></label>
      <h5 className="fsec">Financiamento</h5>
      <div className="fgrid">
        <Eur label="Total levantado" v={v.financiamento.totalEur} on={(n) => fin({ totalEur: n })} />
        <Eur label="Ronda atual" v={v.financiamento.rondaAtualEur} on={(n) => fin({ rondaAtualEur: n })} />
        <label className="fld"><span>À procura de financiamento</span><select value={v.financiamento.procura} onChange={(e) => fin({ procura: e.target.value as AnalisePerfil["financiamento"]["procura"] })}>
          <option value="sim">Sim</option><option value="nao">Não</option><option value="desconhecido">Sem dados</option></select></label>
      </div>
      <Lista label="Rondas (uma por linha: data, tipo, montante)" v={v.financiamento.rondas} on={(l) => fin({ rondas: l })} />
      <Lista label="Investidores (um por linha)" v={v.financiamento.investidores} on={(l) => fin({ investidores: l })} />
      <h5 className="fsec">Equipa</h5>
      {v.equipa.map((p, i) => (
        <div key={i} className="pf-eq">
          <input aria-label={`Nome ${i + 1}`} placeholder="Nome" value={p.nome} onChange={(e) => set({ equipa: v.equipa.map((x, k) => k === i ? { ...x, nome: e.target.value } : x) })} />
          <input aria-label={`Cargo ${i + 1}`} placeholder="Cargo" value={p.cargo} onChange={(e) => set({ equipa: v.equipa.map((x, k) => k === i ? { ...x, cargo: e.target.value } : x) })} />
          <input aria-label={`Percurso ${i + 1}`} placeholder="Percurso" value={p.percurso} onChange={(e) => set({ equipa: v.equipa.map((x, k) => k === i ? { ...x, percurso: e.target.value } : x) })} />
          <button type="button" className="btn icon" aria-label={`Tirar ${p.nome || "pessoa"}`} onClick={() => set({ equipa: v.equipa.filter((_, k) => k !== i) })}><Icon name="trash" /></button>
        </div>
      ))}
      <button type="button" className="txtbtn" onClick={() => set({ equipa: [...v.equipa, { nome: "", cargo: "", percurso: "" }] })}><Icon name="plus" />Juntar pessoa</button>
      <h5 className="fsec">Em falta</h5>
      <Lista label="Dados que ainda faltam (um por linha)" v={v.emFalta} on={(l) => set({ emFalta: l })} />
    </div>
  );
}

function Lista({ label, v, on }: { label: string; v: string[]; on: (l: string[]) => void }) {
  const [t, setT] = useState(v.join("\n"));
  return <label className="fld full"><span>{label}</span><textarea rows={Math.min(6, Math.max(2, v.length + 1))} value={t}
    onChange={(e) => { setT(e.target.value); on(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean)); }} /></label>;
}

function Eur({ label, v, on }: { label: string; v: number | null; on: (n: number | null) => void }) {
  const [t, setT] = useState(fmtEur(v));
  const bad = !!t.trim() && parseEur(t) === null;
  return <label className="fld"><span>{label}</span><input value={t} inputMode="decimal" placeholder="ex.: 1,5 M ou 350k" aria-invalid={bad}
    onChange={(e) => setT(e.target.value)} onBlur={() => { const n = parseEur(t); on(t.trim() ? n : null); if (n !== null) setT(fmtEur(n)); }} />
    {bad && <em className="ferr">Escreve um valor como 1,5 M ou 350k</em>}</label>;
}
