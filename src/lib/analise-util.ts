import { Analise, CICLOS, CRITERIOS, GRUPOS_CRITERIOS, MATRIZ, Startup, TICKETS, VEREDICTOS, VERTICAIS, Veredicto, nomeDecisao } from "./types";
import { fdLongo } from "./util";

export type Elegibilidade = "sim" | "dados" | "nao";
/**
 * Cumpre os critérios de cada ticket? Até 200 mil €: a maioria dos que contam (must meet most).
 * Mais de 200 mil €: todos (must meet). "dados" = depende do que ainda está incerto.
 */
export function elegibilidade(a: Pick<Analise, "criterios">): Elegibilidade[] {
  const v = (id: string): Veredicto => a.criterios.find((c) => c.id === id)?.veredicto || "incerto";
  return TICKETS.map((_, i) => {
    const linhas = MATRIZ.filter((m) => m.peso[i] > 0).map((m) => v(m.criterio));
    const p = linhas.filter((x) => x === "positivo").length, u = linhas.filter((x) => x === "incerto").length, n = linhas.length;
    if (i === 2) return p === n ? "sim" : linhas.includes("negativo") ? "nao" : "dados";
    return p > n / 2 ? "sim" : p + u > n / 2 ? "dados" : "nao";
  });
}

const eur = (n: number | null) => (n == null ? "Sem dados" : n >= 1e6 ? `${(n / 1e6).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} M€` : `${Math.round(n / 1e3).toLocaleString("pt-PT")} mil €`);
export const euros = eur;
export const nomeVertical = (id: string) => VERTICAIS.find((v) => v.id === id)?.nome || id;
export const nomeCiclo = (id: string) => CICLOS.find((c) => c.id === id)?.nome || id;
export const nomeTicket = (id: string | null) => TICKETS.find((t) => t.id === id)?.nome || "Nenhum";
export const PROCURA = { sim: "Sim", nao: "Não", desconhecido: "Sem dados" } as const;

/** Relatório em Markdown, para copiar para email, Teams ou Word. */
export function analiseMarkdown(s: Pick<Startup, "nome" | "site">, a: Analise): string {
  const p = a.perfil, f = p.financiamento, L: string[] = [];
  const li = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`) : ["- Sem dados"]);
  L.push(`# Análise de investimento: ${s.nome}`, "", `${s.site} · ${fdLongo(a.feitaEm)}`, "");
  L.push(`**Decisão:** ${nomeDecisao(a.decisao)}${a.condicoes ? ` (${a.condicoes})` : ""}`);
  L.push(`**Ticket:** ${nomeTicket(a.ticket)} · **Follow-on:** ${a.followOn ? "Sim" : "Não"}${a.desafio ? ` · **Desafio 2026:** ${a.desafio}` : ""}`, "", a.racional, "");
  L.push("## Perfil", "", p.resumo, "",
    `- Vertical: ${nomeVertical(p.vertical)}`, `- Ciclo de vida: ${nomeCiclo(p.ciclo)}`, `- Fundação: ${p.fundacao || "Sem dados"}`,
    `- Sede: ${p.sede}`, `- Mercados: ${p.mercados}`, `- Produto: ${p.produto}`, `- Clientes-alvo: ${p.clientesAlvo}`,
    `- Modelo de negócio: ${p.modeloNegocio}`, `- Tecnologia: ${p.tecnologia}`, `- Cadeia de valor do vinho: ${p.cadeiaValor}`, "");
  L.push("### Tração", "", `- Receita: ${p.tracao.receita}`, `- Clientes: ${p.tracao.clientes}`, `- Pilotos: ${p.tracao.pilotos}`, "");
  L.push("### Equipa", "", ...(p.equipa.length ? p.equipa.map((e) => `- ${e.nome}, ${e.cargo}: ${e.percurso}`) : ["- Sem dados"]), "");
  L.push("### Financiamento", "", `- Total levantado: ${eur(f.totalEur)}`, `- À procura de financiamento: ${PROCURA[f.procura]}`, `- Ronda atual: ${eur(f.rondaAtualEur)}`,
    `- Rondas: ${f.rondas.join("; ") || "Sem dados"}`, `- Investidores: ${f.investidores.join(", ") || "Sem dados"}`, "");
  L.push("## Avaliação", "");
  for (const g of GRUPOS_CRITERIOS) {
    L.push(`### ${g.nome}`, "");
    for (const c of CRITERIOS.filter((x) => x.grupo === g.id)) {
      const r = a.criterios.find((x) => x.id === c.id);
      L.push(`**${c.nome}: ${VEREDICTOS[r?.veredicto || "incerto"].nome}**`, "", r?.justificacao || "", "");
    }
  }
  const el = elegibilidade(a);
  L.push("## Matriz por ticket", "", `| Critério | ${TICKETS.map((t) => t.nome).join(" | ")} |`, `|---|${TICKETS.map(() => "---").join("|")}|`);
  for (const m of MATRIZ) {
    const v = VEREDICTOS[a.criterios.find((c) => c.id === m.criterio)?.veredicto || "incerto"].nome;
    L.push(`| ${m.nome} | ${m.peso.map((w) => (w ? v : "")).join(" | ")} |`);
  }
  L.push(`| **Cumpre** | ${el.map((e) => ({ sim: "Sim", dados: "Faltam dados", nao: "Não" })[e]).join(" | ")} |`, "");
  L.push("## Resumo", "", "**Forças**", "", ...li(a.forcas), "", "**Riscos**", "", ...li(a.riscos), "", "**Informação em falta**", "", ...li(a.emFalta), "");
  L.push("## Ticket e follow-on", "", `${nomeTicket(a.ticket)}. ${a.ticketRacional}`, "", `Follow-on: ${a.followOn ? "Sim" : "Não"}. ${a.followOnRacional}`, "");
  L.push("## Encaixe no portefólio", "", a.encaixe, "", "## Próximos passos", "", ...a.proximosPassos.map((x, i) => `${i + 1}. ${x}`), "");
  L.push("## Fontes", "", ...a.fontes.map((x) => `- [${x.titulo}](${x.url})`));
  return L.join("\n");
}
