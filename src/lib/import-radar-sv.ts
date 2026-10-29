/**
 * Importação provisória do Excel «Radar Sogrape Ventures» (folha do ano, ex.: «2026»).
 * A coluna «Categorização» diz onde cada startup deve estar: Arquivo de triagem, Aprovada, Validation Fit, Radar, Arquivo de pipeline…
 * Só leitura, conversão e plano (sem Firestore): a gravação fica no componente de importação.
 */
import type { Celula } from "./xlsx-lite";
import { dataDe, startupIdDe } from "./import-dealflow";
import { ETAPAS, type Deal, type Etapa, type Fase, type FaseDF, type MotivoArquivo, type OrigemTipo, type Startup, type Status, type VerticalDF } from "./types";
import { ondeDeal, ondeStartup } from "./localizacao";
import { slug } from "./util";

export type Destino = { tipo: "triagem"; status: Status } | { tipo: "pipeline"; etapa: Etapa };

export type LinhaSV = {
  /** Linha no Excel, para mensagens. */ linha: number;
  nome: string; site: string; dominio: string; fonte: string;
  /** Data de entrada (AAAA-MM-DD). */ data: string;
  descricao: string; pais: string; vertical: string; ciclo: string; financiamento: string;
  decisao: string; feedback: string; proximos: string;
  /** Data da decisão (AAAA-MM-DD), quando existe. */ dataDecisao: string;
  categorizacao: string; destino: Destino | null;
};

const txt = (v: Celula | undefined) => (v === null || v === undefined ? "" : String(v)).replace(/\s+/g, " ").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/** O mesmo critério de nomes do pipeline: sem acentos, sem espaços nem pontuação, sem o que está entre parênteses. */
export const normNomeSV = (s: string) => slug((s || "").replace(/\(.*?\)/g, "")).replace(/-/g, "");
/** Sites que não são da própria startup não servem para reconhecer startups. */
const ALHEIO = /(^|\.)(linkedin|facebook|instagram|twitter|x|youtube|f6s|crunchbase|dealroom|google|linktr|notion|wixsite|medium)\./;
export const dominioDe = (site: string) => site.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
const dominioProprio = (d: string) => (!!d && d.includes(".") && !ALHEIO.test(`.${d}`) ? d : "");

/** «Categorização» → onde deve estar. Aceita os nomes das fases do pipeline e as formas «Pipeline - Arquivo», «Triagem - Arquivo». */
export function destinoDe(c: string): Destino | null {
  const t = norm(c).replace(/[–—-]/g, " ").replace(/\s+/g, " ");
  if (!t) return null;
  const arquivo = /arquiv|archiv/.test(t);
  if (arquivo && /pipeline/.test(t)) return { tipo: "pipeline", etapa: "arquivada" };
  if (arquivo && /triagem|screening/.test(t)) return { tipo: "triagem", status: "rejected" };
  if (/^(rejeitada|rejected)$/.test(t)) return { tipo: "triagem", status: "rejected" };
  if (/^aprovad|^approved/.test(t)) return { tipo: "triagem", status: "approved" };
  if (/^(triagem|por decidir|pending|pendente)$/.test(t)) return { tipo: "triagem", status: "pending" };
  if (/^(investida|invested|portefolio|portfolio)/.test(t)) return { tipo: "pipeline", etapa: "investida" };
  if (/^(arquivada|archived)$/.test(t)) return { tipo: "pipeline", etapa: "arquivada" };
  const e = ETAPAS.find((x) => norm(x.nome) === t.replace(/^pipeline /, ""));
  return e ? { tipo: "pipeline", etapa: e.id } : null;
}
export const ondeDestino = (d: Destino) => (d.tipo === "pipeline" ? ondeDeal({ etapa: d.etapa }) : ondeStartup({ status: d.status }));

/** Converte a folha. O cabeçalho é a linha com «Startup Name»; a coluna «Categorização» é obrigatória. */
export function converterRadarSV(rows: Celula[][]): LinhaSV[] {
  const h = rows.findIndex((r) => (r || []).some((c) => norm(txt(c)) === "startup name"));
  if (h < 0) throw new Error("Não encontrei o cabeçalho (coluna «Startup Name»). Confirma que é o Excel do Radar Sogrape Ventures.");
  const cab = (rows[h] || []).map((c) => norm(txt(c)));
  const col = (nome: string) => cab.findIndex((c) => c === nome || c.startsWith(nome));
  const c = {
    nome: col("startup name"), fonte: col("source"), data: cab.indexOf("date"), site: col("website"), desc: col("description"), pais: col("country"),
    vertical: col("vertical"), ciclo: col("startup life cycle"), fin: col("funding raised"),
    // A segunda coluna «Date» é a data da decisão (a seguir às colunas do financiamento)
    dataDec: cab.lastIndexOf("date"), feedback: col("feedback"), decisao: col("stepwise decision"), proximos: col("next steps"), cat: col("categoriza"),
  };
  if (c.cat < 0) throw new Error("O Excel não tem a coluna «Categorização».");
  const out: LinhaSV[] = [];
  rows.slice(h + 1).forEach((r, k) => {
    const nome = txt(r?.[c.nome]);
    if (!nome) return;
    const g = (i: number) => (i >= 0 ? txt(r[i]) : "");
    const raw = (i: number) => (i >= 0 ? r[i] : null);
    // Um site com espaços ou sem domínio (ex.: «VARTHEO | Consumer Simulation Platform») não é um site
    const site0 = g(c.site), okSite = !!site0 && !/\s/.test(site0) && /\.[a-z]{2,}/i.test(site0);
    const site = okSite ? (/^https?:\/\//i.test(site0) ? site0 : `https://${site0}`) : "";
    const categorizacao = g(c.cat);
    out.push({
      linha: h + 2 + k, nome, site, dominio: dominioProprio(dominioDe(site)), fonte: g(c.fonte), data: dataDe(raw(c.data) ?? undefined),
      descricao: g(c.desc), pais: g(c.pais), vertical: g(c.vertical), ciclo: g(c.ciclo), financiamento: g(c.fin),
      decisao: g(c.decisao), feedback: g(c.feedback), proximos: g(c.proximos),
      dataDecisao: c.dataDec !== c.data ? dataDe(raw(c.dataDec) ?? undefined) : "", categorizacao, destino: destinoDe(categorizacao),
    });
  });
  return out;
}

/* ---------- Plano: onde está cada uma e para onde vai ---------- */

export type Passo = {
  l: LinhaSV;
  st?: Startup; deal?: Deal;
  /** Onde está agora (null: ainda não existe). */ atual: string[] | null;
  novo: string[];
  acao: "criar" | "mover" | "igual" | "erro";
  erro?: string;
};

/** Para cada linha, procura a startup (pelo domínio do site ou pelo nome) e a ficha do pipeline, e diz o que vai mudar. */
export function planear(linhas: LinhaSV[], startups: Startup[], deals: Deal[]): Passo[] {
  // Linhas repetidas no Excel: conta a última
  const ultima = new Map<string, number>();
  linhas.forEach((l, i) => ultima.set(normNomeSV(l.nome), i));
  return linhas.map((l, i): Passo => {
    if (ultima.get(normNomeSV(l.nome)) !== i) return { l, atual: null, novo: [], acao: "erro", erro: "Repetida no Excel (conta a última linha)" };
    if (!l.destino) return { l, atual: null, novo: [], acao: "erro", erro: l.categorizacao ? `Categorização desconhecida: «${l.categorizacao}»` : "Sem categorização" };
    const n = normNomeSV(l.nome);
    let deal = deals.find((d) => !!l.dominio && d.dominio === l.dominio) || deals.find((d) => !!n && normNomeSV(d.nome) === n);
    const st = (deal?.startupId && startups.find((s) => s.id === deal!.startupId))
      || startups.find((s) => !!l.dominio && s.dominio === l.dominio) || startups.find((s) => !!n && normNomeSV(s.nome) === n) || undefined;
    if (!deal && st) deal = deals.find((d) => d.startupId === st.id || (!!st.dealId && d.id === st.dealId));
    const atual = deal ? ondeDeal(deal) : st ? ondeStartup(st) : null;
    const novo = ondeDestino(l.destino);
    const d = l.destino;
    const igual = d.tipo === "pipeline" ? !!deal && deal.etapa === d.etapa : !deal && !!st && st.status === d.status;
    return { l, st, deal, atual, novo, acao: !atual ? "criar" : igual ? "igual" : "mover" };
  });
}

/* ---------- Conversões para as fichas novas ---------- */

const VERT_CADEIA: Record<string, string> = {
  viticulture: "viticultura", winemaking: "enologia", production: "producao", distribution: "vendas-distribuicao",
  "wine related products": "adjacencias", "wine related services": "consumidor", "other strategic": "adjacencias", "other out of scope": "adjacencias",
};
const VERT_DF: Record<string, VerticalDF> = {
  viticulture: "viticultura", winemaking: "enologia", production: "producao", distribution: "distribuicao",
  "wine related products": "produtos-vinho", "wine related services": "servicos-vinho", "other strategic": "outro-estrategico", "other out of scope": "fora-ambito",
};
const vkey = (v: string) => norm(v).replace(/-/g, " ");
export const cadeiaDeSV = (l: Pick<LinhaSV, "vertical">) => VERT_CADEIA[vkey(l.vertical)] || "adjacencias";
export const verticalDfDeSV = (l: Pick<LinhaSV, "vertical">): VerticalDF | "" => VERT_DF[vkey(l.vertical)] || "";

/** «Seed (€100K - €1M)», «Series A (€1M - €10M)», «Pre-Series A»… → fase do radar e fase do pipeline. */
export function fasesDeSV(ciclo: string): { fase: Fase; faseDF: FaseDF | "" } {
  const t = norm(ciclo);
  if (!t || t.startsWith("not applicable")) return { fase: "seed", faseDF: "" };
  if (t.startsWith("mvp")) return { fase: "ideia", faseDF: "ideia" };
  if (t.startsWith("pre seed") || t.startsWith("pre-seed")) return { fase: "seed", faseDF: "pre-seed" };
  if (t.startsWith("pre serie") || t.startsWith("pre-serie")) return { fase: "seed", faseDF: "seed" };
  if (t.startsWith("seed")) return { fase: "seed", faseDF: "seed" };
  if (t.startsWith("series a") || t.startsWith("serie a")) return { fase: "serie-a", faseDF: "serie-a" };
  if (t.startsWith("series b")) return { fase: "crescimento", faseDF: "scale-up" };
  return { fase: "crescimento", faseDF: "crescimento" };
}

/** «Sogrape [Plug&Play]», «La Wine Tech», «AI Research» → tipo de origem do pipeline. */
export function origemDeSV(fonte: string): { tipo: OrigemTipo; nome: string; contacto: string } {
  const t = norm(fonte);
  const tipo: OrigemTipo = /plug|demeter|venture ?radar|partner|beta/.test(t) ? "parceiro"
    : /tech|summit|vivatech|startup win|expo|event|hack|challenge|congress|fair/.test(t) ? "evento"
    : /research|sourcing|scouting|pesquisa/.test(t) ? "pesquisa" : /sogrape/.test(t) ? "rede" : "outro";
  return { tipo, nome: fonte || "Excel do Radar Sogrape Ventures", contacto: "" };
}

/** Motivo de arquivo pelo texto do Excel. Sem pistas claras, fica «sem motivo registado» (a nota guarda o texto). */
export function motivoArquivoDeSV(texto: string): MotivoArquivo {
  const t = norm(texto);
  if (/without answer|no answer|did not reply|didn.t reply|no reply|no response|sem resposta|not reply/.test(t)) return "sem-resposta";
  if (/not (actively |currently )?looking for invest|not raising|no (open )?round|not .*fundrais/.test(t)) return "ronda";
  if (/valuation/.test(t)) return "valuation";
  if (/business case|too early|early stage|early-stage|prematur/.test(t)) return "early";
  if (/out of scope|non investment fit|not .*strategic|fora de ambito/.test(t)) return "fora-ambito";
  if (/use case|caso de uso/.test(t)) return "sem-caso-uso";
  return "sem-registo";
}
/** Motivo para o arquivo de triagem, pela decisão do Excel. */
export const motivoTriagemDeSV = (decisao: string) => {
  const t = norm(decisao);
  return t === "no go" ? "No go" : t === "not prioritary" || t === "not priority" ? "Não prioritária" : t ? decisao : "Arquivada no Excel";
};

/** Ficha nova no radar de startups (sem categoria: a Gemini atribui depois, com «Atribuir categorias»). */
export function startupDoExcel(l: LinhaSV, status: Status, por: string, agora: string): Omit<Startup, "id"> & { id: string } {
  const quando = l.data ? `${l.data}T12:00:00.000Z` : agora;
  const fin = l.financiamento && !/^(n\/?a|-|0)$/i.test(l.financiamento) ? `${l.financiamento}${/€|eur|\$/i.test(l.financiamento) ? "" : " €"}` : "";
  return {
    id: startupIdDe(l.nome, l.dominio),
    status, nome: l.nome, site: l.site, dominio: l.dominio, pais: l.pais, fundacao: null, fase: fasesDeSV(l.ciclo).fase, setor: "", cadeia: cadeiaDeSV(l),
    descricao: l.descricao, porque: l.feedback, relevancia: 50, financiamento: fin, investidores: [],
    origens: [{ tipo: "manual", titulo: `Excel Radar Sogrape Ventures${l.fonte ? ` · ${l.fonte}` : ""}`, url: l.site, data: quando }],
    destaque: false, manual: true, criadoPor: por, criadoEm: quando, atualizadoEm: agora,
    ...(status === "approved" ? { aprovadoEm: quando, aprovadoPor: por } : {}),
    ...(status === "rejected" ? { motivoRejeicao: motivoTriagemDeSV(l.decisao) } : {}),
  };
}
