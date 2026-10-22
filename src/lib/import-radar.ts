/**
 * Import do Excel «Radar Sogrape Ventures» (folha do ano, por exemplo «2026»).
 * Cada linha é uma startup; a «Stepwise Decision» decide para onde vai:
 * NO GO → arquivo da triagem; NOT PRIORITARY → aprovadas; ARCHIVED → arquivo do pipeline;
 * CONTACT ESTABLISHED (e GO) → primeira fase do pipeline; sem decisão → triagem.
 */
import type { Celula } from "./xlsx-lite";
import { dataDe } from "./import-dealflow";
import type { Fase, FaseDF, OrigemTipo, VerticalDF } from "./types";

export type DestinoRadar = "rejeitada" | "aprovada" | "arquivo-pipeline" | "pipeline" | "triagem";
export const DESTINOS_RADAR: { id: DestinoRadar; nome: string; decisao: string }[] = [
  { id: "rejeitada", nome: "Arquivo da triagem", decisao: "NO GO" },
  { id: "aprovada", nome: "Aprovadas", decisao: "NOT PRIORITARY" },
  { id: "arquivo-pipeline", nome: "Arquivo do pipeline", decisao: "ARCHIVED" },
  { id: "pipeline", nome: "Pipeline · Validation Fit", decisao: "CONTACT ESTABLISHED ou GO" },
  { id: "triagem", nome: "Triagem (por decidir)", decisao: "sem decisão" },
];

export type LinhaRadar = {
  k: number; nome: string; fonte: string; data: string; site: string; dominio: string; descricao: string; pais: string;
  vertical: VerticalDF | ""; verticalExcel: string; ciclo: string; faseStartup: Fase; faseDeal: FaseDF | "";
  financiamento: string; procura: string; quanto: string; dataDecisao: string; feedback: string; decisao: string; proximos: string;
  destino: DestinoRadar;
};

const txt = (v: Celula | undefined) => (v === null || v === undefined ? "" : String(v)).replace(/\s+/g, " ").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Domínio de um site (sem www), como na recolha semanal. */
export function dominioDe(url: string) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\d?\./, ""); } catch { return ""; }
}

const VERTICAL: Record<string, VerticalDF> = {
  viticulture: "viticultura", winemaking: "enologia", production: "producao", distribution: "distribuicao",
  "wine related products": "produtos-vinho", "wine related services": "servicos-vinho", "other strategic": "outro-estrategico", "other out of scope": "fora-ambito",
};
/** Cadeia de valor pela vertical do Excel, quando a Gemini não classificar. */
export const CADEIA_DA_VERTICAL: Record<string, string> = {
  viticultura: "viticultura", enologia: "enologia", producao: "producao", distribuicao: "vendas-distribuicao",
  "produtos-vinho": "adjacencias", "servicos-vinho": "consumidor", "outro-estrategico": "adjacencias", "fora-ambito": "adjacencias",
};

function fases(ciclo: string): { s: Fase; d: FaseDF | "" } {
  const c = norm(ciclo);
  if (/mvp/.test(c)) return { s: "ideia", d: "ideia" };
  if (/pre-?seed/.test(c)) return { s: "seed", d: "pre-seed" };
  if (/seed/.test(c)) return { s: "seed", d: "seed" };
  if (/pre-?seri|series a|serie a/.test(c)) return { s: "serie-a", d: "serie-a" };
  if (/series [b-z]|serie [b-z]|growth/.test(c)) return { s: "crescimento", d: "crescimento" };
  return { s: "seed", d: "" };
}

function destino(decisao: string): DestinoRadar {
  const d = norm(decisao);
  if (d === "no go") return "rejeitada";
  if (d === "not prioritary" || d === "not priority") return "aprovada";
  if (d === "archived") return "arquivo-pipeline";
  if (d === "contact established" || d === "go") return "pipeline";
  return "triagem";
}

/** Tipo de origem para o pipeline: programas e eventos, parceiros da Sogrape ou pesquisa. */
export function origemDe(fonte: string): { tipo: OrigemTipo; nome: string } {
  const f = norm(fonte);
  if (/^sogrape \[/.test(f)) return { tipo: "parceiro", nome: fonte.replace(/^Sogrape\s*\[|\]$/gi, "").trim() || fonte };
  if (/research|sourcing/.test(f)) return { tipo: "pesquisa", nome: fonte };
  return { tipo: "evento", nome: fonte || "Radar Sogrape Ventures" };
}

/** Lê a folha do Radar (cabeçalhos na primeira linha). */
export function converterRadar(rows: Celula[][]): LinhaRadar[] {
  const h = (rows[0] || []).map((x) => norm(txt(x)));
  // Há duas colunas «Date»: a primeira é a entrada no radar, a segunda a data da decisão
  const col = (nome: string, n = 0) => { let i = -1; for (let k = 0; k <= n; k++) i = h.indexOf(nome, i + 1); return i; };
  const c = {
    nome: col("startup name"), fonte: col("source"), data: col("date"), site: col("website"), descricao: col("description"), pais: col("country"),
    vertical: col("vertical"), ciclo: col("startup life cycle"), fin: h.findIndex((x) => x.startsWith("funding raised")), procura: h.findIndex((x) => x.startsWith("actively looking")),
    quanto: h.findIndex((x) => x.startsWith("how much funding")), data2: col("date", 1), feedback: col("feedback"), decisao: col("stepwise decision"), proximos: col("next steps"),
  };
  const g = (r: Celula[], i: number) => (i >= 0 ? r[i] : null);
  return rows.slice(1).map((r, k) => {
    const nome = txt(g(r, c.nome));
    if (!nome) return null;
    const site = txt(g(r, c.site)), vEx = txt(g(r, c.vertical)), ciclo = txt(g(r, c.ciclo)), f = fases(ciclo), decisao = txt(g(r, c.decisao));
    return {
      k, nome, fonte: txt(g(r, c.fonte)), data: dataDe(g(r, c.data) ?? undefined), site: site && !/^https?:\/\//i.test(site) ? `https://${site}` : site, dominio: dominioDe(site),
      descricao: txt(g(r, c.descricao)), pais: txt(g(r, c.pais)), vertical: VERTICAL[norm(vEx)] || "", verticalExcel: vEx, ciclo, faseStartup: f.s, faseDeal: f.d,
      financiamento: txt(g(r, c.fin)), procura: txt(g(r, c.procura)), quanto: txt(g(r, c.quanto)), dataDecisao: dataDe(g(r, c.data2) ?? undefined),
      feedback: txt(g(r, c.feedback)), decisao, proximos: txt(g(r, c.proximos)), destino: destino(decisao),
    } as LinhaRadar;
  }).filter((x): x is LinhaRadar => !!x);
}
