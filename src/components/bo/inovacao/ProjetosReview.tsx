"use client";
import { Icon } from "@/components/Icon";
import type { Area, Startup } from "@/lib/types";
import { MWB, MWB_DESC, Projeto, corDe } from "@/lib/inovacao";
import { ProjIcone } from "./shared";

/** Ícone de cada cadeia de valor (as que não estão aqui ficam com o globo). */
const ICONE: Record<string, string> = { viticultura: "leaf", enologia: "wine", producao: "gear", marketing: "target", "vendas-distribuicao": "briefcase", consumidor: "users", adjacencias: "globe" };
const SEM = "_";

/**
 * Review dos projetos, como o quadro «Must Win Battles and Challenges»: as cadeias de valor são colunas
 * que atravessam a página e cada Must Win Battle é uma caixa por cima delas, com os projetos lá dentro,
 * cada um na coluna da sua cadeia. A caixa estende-se só pelas colunas onde a Must Win Battle tem projetos.
 */
export function ProjetosReview({ projetos, areas, startups, onOpen }: { projetos: Projeto[]; areas: Area[]; startups: Startup[]; onOpen: (id: string) => void }) {
  const semCadeia = projetos.some((p) => !areas.some((a) => a.id === p.cadeia));
  const colunas = [...areas.map((a) => ({ id: a.id, nome: a.nome })), ...(semCadeia ? [{ id: SEM, nome: "Sem cadeia de valor" }] : [])];
  const colDe = (p: Projeto) => { const i = colunas.findIndex((c) => c.id === p.cadeia); return i >= 0 ? i : colunas.length - 1; };
  const caixas = [...MWB, ...(projetos.some((p) => !MWB.includes(p.mwb)) ? [SEM] : [])].map((m) => {
    const l = projetos.filter((p) => (m === SEM ? !MWB.includes(p.mwb) : p.mwb === m)).sort((a, b) => a.nome.localeCompare(b.nome));
    const cols = l.map(colDe);
    // Sem projetos: a caixa ocupa a largura toda, mais leve
    const de = cols.length ? Math.min(...cols) : 0, ate = cols.length ? Math.max(...cols) : colunas.length - 1;
    return { m, l, de, ate, linha: 0 };
  });
  // Arruma as caixas em linhas: as que não se sobrepõem nas colunas partilham a mesma linha (como no quadro original)
  const ocupadas: [number, number][][] = [];
  for (const c of caixas.filter((x) => x.l.length)) {
    let r = ocupadas.findIndex((lin) => lin.every(([a, b]) => c.ate < a || c.de > b));
    if (r < 0) { ocupadas.push([]); r = ocupadas.length - 1; }
    ocupadas[r].push([c.de, c.ate]); c.linha = r;
  }
  // As Must Win Battles sem projetos ficam no fim, cada uma na sua linha, a toda a largura
  caixas.filter((x) => !x.l.length).forEach((c) => { c.linha = ocupadas.length; ocupadas.push([[0, colunas.length - 1]]); });

  return (
    <div className="rv-wrap">
      <div className="rv" style={{ ["--n" as string]: colunas.length, gridTemplateRows: `auto repeat(${ocupadas.length}, auto)` }}>
        {colunas.map((c, i) => <div key={`f-${c.id}`} className={`rv-col${c.id === SEM ? " sem" : ""}`} style={{ gridColumn: i + 1 }} aria-hidden="true" />)}
        {colunas.map((c, i) => (
          <div key={c.id} className={`rv-h${c.id === SEM ? " sem" : ""}`} style={{ gridColumn: i + 1 }}>
            <Icon name={ICONE[c.id] || "globe"} size={22} /><span>{c.nome}</span>
          </div>))}
        {caixas.map(({ m, l, de, ate, linha }) => (
          <section key={m} className={`rv-mwb${l.length ? "" : " vazia"}${ate === de ? " uma" : ""}`} aria-label={m === SEM ? "Sem Must Win Battle" : m}
            style={{ gridColumn: `${de + 1} / ${ate + 2}`, gridRow: linha + 2, ["--c" as string]: m === SEM ? "#94A3B8" : corDe(m) }}>
            <header>
              <b>{m === SEM ? "Sem Must Win Battle" : m}</b>
              {m !== SEM && MWB_DESC[m] && <span title={MWB_DESC[m]}>{MWB_DESC[m]}</span>}
              {!l.length && <em>Sem projetos</em>}
            </header>
            {l.length > 0 && (
              <div className="rv-in">
                {Array.from({ length: ate - de + 1 }, (_, j) => de + j).map((ci) => (
                  <div key={ci} className="rv-cell">
                    {l.filter((p) => colDe(p) === ci).map((p) => (
                      <button key={p.id} type="button" className={`rv-chip ${p.relacao === "Startup" ? "st" : "in"}`} onClick={() => onOpen(p.id)}
                        title={`${p.nome}: ${p.estado}${p.fase && p.estado !== "To Start" ? `, ${p.fase}` : ""}`}>
                        <ProjIcone p={p} startups={startups} size={22} /><span>{p.nome}</span>
                      </button>))}
                  </div>))}
              </div>)}
          </section>))}
      </div>
      <div className="rv-leg">
        <span className="rv-chip in"><span>Projetos internos</span></span>
        <span className="rv-chip st"><span>Pilotos com startups</span></span>
        <small>Cada projeto está na coluna da sua cadeia de valor, dentro da caixa da sua Must Win Battle.</small>
      </div>
    </div>
  );
}
