"use client";
import { useState } from "react";
import { Analise, CRITERIOS, DECISOES, Decisao, GRUPOS_CRITERIOS, TICKETS, VEREDICTOS, Veredicto } from "@/lib/types";
import { PerfilEditor } from "./PerfilEditor";

/** Edição de tudo o que a análise diz: decisão, ticket, critérios, resumo e perfil. Guarda como uma versão nova (a anterior fica no histórico). */
export function AnaliseEditor({ v, onChange }: { v: Analise; onChange: (a: Analise) => void }) {
  const set = (p: Partial<Analise>) => onChange({ ...v, ...p });
  const crit = (id: string, p: Partial<Analise["criterios"][number]>) => set({ criterios: v.criterios.some((c) => c.id === id)
    ? v.criterios.map((c) => (c.id === id ? { ...c, ...p } : c)) : [...v.criterios, { id: id as Analise["criterios"][number]["id"], veredicto: "incerto", justificacao: "", fontes: [], ...p }] });
  return (
    <div className="dform aned">
      <h5 className="fsec">Decisão</h5>
      <div className="seg aned-dec" role="group" aria-label="Decisão">
        {(Object.keys(DECISOES) as Decisao[]).map((d) => <button key={d} type="button" className={`d-${d}`} aria-pressed={v.decisao === d} onClick={() => set({ decisao: d })}>{DECISOES[d].nome}</button>)}
      </div>
      <div className="fgrid">
        <label className="fld"><span>Ticket</span><select value={v.ticket || ""} onChange={(e) => set({ ticket: (e.target.value || null) as Analise["ticket"] })}>
          <option value="">Nenhum</option>{TICKETS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        <label className="fld"><span>Follow-on</span><select value={v.followOn ? "sim" : "nao"} onChange={(e) => set({ followOn: e.target.value === "sim" })}>
          <option value="sim">Sim</option><option value="nao">Não</option></select></label>
        <label className="fld wide"><span>Desafio 2026</span><input value={v.desafio} onChange={(e) => set({ desafio: e.target.value })} placeholder="Nenhum" /></label>
      </div>
      <T label="Condições (ou o que falta saber, se incerto)" v={v.condicoes} on={(x) => set({ condicoes: x })} />
      <T label="Racional" v={v.racional} on={(x) => set({ racional: x })} rows={4} />
      <T label="Porquê este ticket" v={v.ticketRacional} on={(x) => set({ ticketRacional: x })} />
      <T label="Follow-on: porquê" v={v.followOnRacional} on={(x) => set({ followOnRacional: x })} />
      <T label="Encaixe no portefólio" v={v.encaixe} on={(x) => set({ encaixe: x })} />

      <h5 className="fsec">Critérios</h5>
      {GRUPOS_CRITERIOS.map((g) => (
        <div key={g.id} className="aned-grp"><h6>{g.nome}</h6>
          {CRITERIOS.filter((c) => c.grupo === g.id).map((c) => {
            const r = v.criterios.find((x) => x.id === c.id) || { id: c.id, veredicto: "incerto" as Veredicto, justificacao: "", fontes: [] };
            return (
              <div key={c.id} className="aned-crit">
                <div className="aned-ch"><b>{c.nome}</b>
                  <div className="seg sm" role="group" aria-label={`Veredicto: ${c.nome}`}>
                    {(Object.keys(VEREDICTOS) as Veredicto[]).map((x) => <button key={x} type="button" className={`vd-${x}`} aria-pressed={r.veredicto === x} onClick={() => crit(c.id, { veredicto: x })}>{VEREDICTOS[x].nome}</button>)}
                  </div></div>
                <textarea rows={2} aria-label={`Justificação: ${c.nome}`} value={r.justificacao} onChange={(e) => crit(c.id, { justificacao: e.target.value })} />
              </div>
            );
          })}
        </div>
      ))}

      <h5 className="fsec">Resumo</h5>
      <Lista label="Forças (uma por linha)" v={v.forcas} on={(l) => set({ forcas: l })} />
      <Lista label="Riscos (um por linha)" v={v.riscos} on={(l) => set({ riscos: l })} />
      <Lista label="Informação em falta (uma por linha)" v={v.emFalta} on={(l) => set({ emFalta: l })} />
      <Lista label="Próximos passos (um por linha)" v={v.proximosPassos} on={(l) => set({ proximosPassos: l })} />

      <h5 className="fsec">Perfil</h5>
      <PerfilEditor v={v.perfil} onChange={(perfil) => set({ perfil })} />
    </div>
  );
}

function T({ label, v, on, rows = 2 }: { label: string; v: string; on: (x: string) => void; rows?: number }) {
  return <label className="fld full"><span>{label}</span><textarea rows={rows} value={v} onChange={(e) => on(e.target.value)} /></label>;
}
function Lista({ label, v, on }: { label: string; v: string[]; on: (l: string[]) => void }) {
  const [t, setT] = useState(v.join("\n"));
  return <label className="fld full"><span>{label}</span><textarea rows={Math.min(7, Math.max(2, v.length + 1))} value={t}
    onChange={(e) => { setT(e.target.value); on(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean)); }} /></label>;
}
