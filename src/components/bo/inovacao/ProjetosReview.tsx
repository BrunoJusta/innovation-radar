"use client";
import { Icon } from "@/components/Icon";
import type { Area, Startup } from "@/lib/types";
import { MWB, MWB_DESC, Projeto, corDe } from "@/lib/inovacao";
import { Logo } from "../startups/Logo";

/** Ícone de cada cadeia de valor (as que não estão aqui ficam com o globo). */
const ICONE: Record<string, string> = { viticultura: "leaf", enologia: "wine", producao: "gear", marketing: "target", "vendas-distribuicao": "briefcase", consumidor: "users", adjacencias: "globe" };
const SEM = "_";

/**
 * Review dos projetos: as cadeias de valor em colunas e as Must Win Battles em faixas,
 * com cada projeto na coluna da sua cadeia (como o quadro «Must Win Battles and Challenges»).
 */
export function ProjetosReview({ projetos, areas, startups, onOpen }: { projetos: Projeto[]; areas: Area[]; startups: Startup[]; onOpen: (id: string) => void }) {
  const semCadeia = projetos.some((p) => !areas.some((a) => a.id === p.cadeia));
  const colunas = [...areas.map((a) => ({ id: a.id, nome: a.nome })), ...(semCadeia ? [{ id: SEM, nome: "Sem cadeia de valor" }] : [])];
  const linhas = [...MWB, ...(projetos.some((p) => !MWB.includes(p.mwb)) ? [SEM] : [])];
  const daCelula = (m: string, c: string) => projetos.filter((p) => (m === SEM ? !MWB.includes(p.mwb) : p.mwb === m) && (c === SEM ? !areas.some((a) => a.id === p.cadeia) : p.cadeia === c))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const st = (p: Projeto) => (p.startupId ? startups.find((s) => s.id === p.startupId) : undefined);

  return (
    <div className="rv-wrap">
      <div className="rv" style={{ ["--n" as string]: colunas.length }}>
        {colunas.map((c) => <div key={c.id} className={`rv-h${c.id === SEM ? " sem" : ""}`}><Icon name={ICONE[c.id] || "globe"} size={20} /><span>{c.nome}</span></div>)}
        {linhas.map((m) => {
          const n = projetos.filter((p) => (m === SEM ? !MWB.includes(p.mwb) : p.mwb === m)).length;
          return (<div key={m} style={{ display: "contents" }}>
            <div className={`rv-band${n ? "" : " vazia"}`} style={{ ["--c" as string]: m === SEM ? "#94A3B8" : corDe(m) }}>
              <b>{m === SEM ? "Sem Must Win Battle" : m}</b>
              {m !== SEM && MWB_DESC[m] && <span>{MWB_DESC[m]}</span>}
              <em>{n ? `${n} ${n === 1 ? "projeto" : "projetos"}` : "Sem projetos"}</em>
            </div>
            {n > 0 && colunas.map((c) => (
              <div key={c.id} className="rv-cell">
                {daCelula(m, c.id).map((p) => {
                  const s = st(p), startup = p.relacao === "Startup";
                  return (
                    <button key={p.id} type="button" className={`rv-chip ${startup ? "st" : "in"}`} onClick={() => onOpen(p.id)} title={`${p.nome}: ${p.estado}${p.fase && p.estado !== "To Start" ? `, ${p.fase}` : ""}`}>
                      {s?.logo && <Logo nome={s.nome} logo={s.logo} />}<span>{p.nome}</span>
                    </button>
                  );
                })}
              </div>))}
          </div>);
        })}
      </div>
      <div className="rv-leg">
        <span className="rv-chip in"><span>Projetos internos</span></span>
        <span className="rv-chip st"><span>Pilotos com startups</span></span>
        <small>Cada projeto está na coluna da sua cadeia de valor e na faixa da sua Must Win Battle.</small>
      </div>
    </div>
  );
}
