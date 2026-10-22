/**
 * Projetos e eventos da equipa de Inovação (coleções «projects» e «events»).
 * Toda a equipa com acesso ao backoffice vê e edita (também nas regras do Firestore).
 */
import type { Celula } from "./xlsx-lite";
import { dataDe } from "./import-dealflow";


export type Projeto = {
  id: string; ref: string; nome: string; descricao: string;
  /** Cadeia de valor (a «Vertical» do Excel). */ cadeia: string;
  mwb: string; horizonte: string; relacao: string;
  parceiro: string; parceiroRef: string;
  /** Startup da base de dados ligada, quando o parceiro é uma startup. */ startupId?: string;
  /** Ícone do projeto (data URL pequeno). Sem ícone, usa o logótipo da startup ligada. */ icone?: string;
  piloto: boolean; pilotoDesde: string;
  inicio: string; fim: string; estado: string;
  orcamento: number | null; gasto: number | null;
  observacoes: string; criadoEm: string; atualizadoEm: string;
  /** Ficha do projeto (como no one-pager de Inovação). */
  desafio?: string; proposta?: string; casoUso?: string; fase?: string;
  equipa?: { nome: string; papel: string }[]; kpis?: string[]; condicoes?: string[];
};

/** Stages de um projeto (as colunas do quadro). */
export const FASES_PROJ = ["Opportunity Identification", "Problem-solution fit", "Product-Market fit", "Reality Builder"];
/** Stages antigos → stages atuais. */
const FASE_ANTIGA: Record<string, string> = { Scouting: "Opportunity Identification", "Pilot Design": "Problem-solution fit", "Pilot Execution": "Product-Market fit", Evaluation: "Product-Market fit", "Scale-up": "Reality Builder" };
export const faseNorm = (f?: string) => (f && FASE_ANTIGA[f]) || f || "";
/** Papéis na equipa do projeto (RACI e PMO). */
export const PAPEIS_EQUIPA = ["Approver", "Responsible", "Supporter", "Consulted", "Informed", "Innovation PMO"];

export type Evento = {
  id: string; ref: string; nome: string;
  tipo: string; objetivo: string; ambito: string; papel: string;
  inicio: string; fim: string; pais: string;
  parceria: boolean; parceiro: string; parceiroRef: string;
  patrocinio: boolean; gasto: number | null; valorPatrocinio: number | null;
  observacoes: string; criadoEm: string; atualizadoEm: string;
  /** Links do evento (página, fotos, notícias, gravação…). */ links?: { titulo: string; url: string }[];
};

/** Estados dos projetos (os separadores da página). */
export const ESTADOS_PROJ = [
  { id: "To Start", cor: "#94A3B8" }, { id: "Ongoing", cor: "#B15533" }, { id: "Graduated", cor: "#2F6B73" },
  { id: "On Hold", cor: "#B07A12" }, { id: "Shelved", cor: "#5E6B7A" },
];
export const ONGOING = "Ongoing";
/** Estados de saída do quadro (os destinos à direita). */
export const DESTINOS_PROJ = ["Graduated", "On Hold", "Shelved"];
/** Projetos que já não estão ativos. */
export const FECHADOS = ["Graduated", "Shelved"];
/** Nomes antigos → atuais: On Going → Ongoing, Transferred to BU → Graduated, Ended e Finished → Shelved. */
export const estadoNorm = (e: string) => {
  const t = (e || "").trim();
  return /^on\s*going$/i.test(t) ? ONGOING : /transfer|graduat/i.test(t) ? "Graduated" : /^(ended|finished|shelved)$/i.test(t) ? "Shelved" : /^on\s*hold$/i.test(t) ? "On Hold" : /^to\s*start$/i.test(t) ? "To Start" : t;
};
/** Must Win Battles, pela ordem do quadro de Inovação. */
export const MWB = ["WineTech", "Unforgettable Experiences", "AI Excellence", "Sustainable Futures", "New Packaging & Materials", "New Beverages"];
/** O que cada Must Win Battle quer dizer (do quadro «Must Win Battles and Challenges»). */
export const MWB_DESC: Record<string, string> = {
  "WineTech": "Cultivating innovation in viticulture and winemaking, identifying new agtech solutions and fostering an approach to winemaking through technology-driven solutions.",
  "Unforgettable Experiences": "Developing exceptional experiences and interactions with our consumers.",
  "AI Excellence": "Leveraging AI across the value chain to enhance decision-making, efficiency and business impact.",
  "Sustainable Futures": "Embedding sustainability across the value chain, driving eco-conscious practices to foster long-term environmental responsibility.",
  "New Packaging & Materials": "Innovating in packaging formats and materials, shaping a more eco-conscious future.",
  "New Beverages": "Embracing innovation in a diverse range of beverages, from alcoholic to non-alcoholic.",
};
/** Nome antigo de Must Win Battle → atual. */
export const mwbNorm = (m: string) => (m === "Product Innovation" ? "New Beverages" : m);
export const HORIZONTES = ["Incremental Innovation", "Transformational Innovation", "Disruptive Innovation"];
export const RELACOES = ["Startup", "Academia", "Corporate", "Accelerator", "Other"];

export const TIPOS_EV = ["External Event", "Internal Event", "Scouting Event", "Design Thinking Sandbox", "Training", "Podcast"];
export const OBJETIVOS_EV = ["Ecosystem Positioning", "Academia Positioning", "Knowledge Acquisition", "Knowledge Sharing", "Startup Scouting & Dealflow", "Innovation Capabilities", "Recognition", "Community Engagement"];
export const AMBITOS = ["External", "Internal"];
export const PAPEIS = ["Participant", "Organizer", "Speaker", "Jury", "Challenger", "Mentor", "Moderator"];

/** «Vertical» do Excel → id da cadeia de valor. */
export const VERTICAL_CADEIA: Record<string, string> = {
  viticulture: "viticultura", winemaking: "enologia", production: "producao", marketing: "marketing",
  "sales & distribution": "vendas-distribuicao", consumer: "consumidor", adjacencies: "adjacencias",
};

export const projetoVazio = (ref: string): Projeto => ({
  id: ref, ref, nome: "", descricao: "", cadeia: "", mwb: "", horizonte: "", relacao: "", parceiro: "", parceiroRef: "",
  piloto: false, pilotoDesde: "", inicio: "", fim: "", estado: "To Start", orcamento: null, gasto: null, observacoes: "", criadoEm: "", atualizadoEm: "",
});
export const eventoVazio = (ref: string): Evento => ({
  id: ref, ref, nome: "", tipo: "External Event", objetivo: "", ambito: "External", papel: "Participant", inicio: "", fim: "", pais: "Portugal",
  parceria: false, parceiro: "", parceiroRef: "", patrocinio: false, gasto: null, valorPatrocinio: null, observacoes: "", criadoEm: "", atualizadoEm: "",
});

/** Próxima referência (PR00023, E00176, PA00041) a partir das que já existem. */
export function proximaRef(prefixo: string, refs: string[]) {
  const n = Math.max(0, ...refs.map((r) => (r.startsWith(prefixo) ? Number(r.slice(prefixo.length)) || 0 : 0)));
  return `${prefixo}${String(n + 1).padStart(5, "0")}`;
}

/** Parceiros já usados nos projetos e eventos (ref → nome). */
export function parceirosDe(l: { parceiro: string; parceiroRef: string }[]) {
  const m = new Map<string, string>();
  for (const x of l) if (x.parceiro.trim()) m.set(x.parceiroRef || `?${x.parceiro.trim()}`, x.parceiro.trim());
  return [...m.entries()].map(([ref, nome]) => ({ ref: ref.startsWith("?") ? "" : ref, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
}

const txt = (v: Celula | undefined) => (v === null || v === undefined ? "" : String(v)).trim();
const num = (v: Celula | undefined) => (typeof v === "number" ? v : txt(v) && !isNaN(Number(txt(v))) ? Number(txt(v)) : null);
const sim = (v: Celula | undefined) => /^(yes|sim|y|true)$/i.test(txt(v));
/** «PA00002 – Porto Business School» → ref e nome. */
const parceiroDe = (v: Celula | undefined) => { const m = txt(v).match(/^(PA\d+)\s*[–-]\s*(.+)$/); return m ? { parceiroRef: m[1], parceiro: m[2].trim() } : { parceiroRef: "", parceiro: txt(v) }; };
const linhas = (rows: Celula[][]) => {
  const h = (rows[0] || []).map((x) => txt(x).toLowerCase());
  return rows.slice(1).filter((r) => r.some((c) => txt(c))).map((r) => (k: string) => r[h.indexOf(k.toLowerCase())]);
};

/** Folha «Fact_Projects» do Excel de Inovação. */
export function projetosDoExcel(rows: Celula[][], agora: string): Projeto[] {
  return linhas(rows).filter((c) => txt(c("ID_Project"))).map((c) => {
    const ref = txt(c("ID_Project")), estado = txt(c("Status"));
    return {
      ...projetoVazio(ref), nome: txt(c("Project Name")), descricao: txt(c("Description")),
      cadeia: VERTICAL_CADEIA[txt(c("Vertical")).toLowerCase()] || "", mwb: txt(c("Must Win Battle")), horizonte: txt(c("Innovation Horizon")),
      relacao: txt(c("Stakeholder Relationship")), ...parceiroDe(c("Partner Display")),
      piloto: sim(c("Pilot Applicable")), pilotoDesde: dataDe(c("Pilot Discussion Start Date")),
      inicio: dataDe(c("Start Date")), fim: dataDe(c("End Date")),
      estado: estadoNorm(estado) || "To Start",
      orcamento: num(c("Estimated Budget")), gasto: num(c("Spent Budget")), observacoes: txt(c("Observations")), criadoEm: agora, atualizadoEm: agora,
    };
  });
}

/** Folha «Fact_Events» do Excel de Inovação. */
export function eventosDoExcel(rows: Celula[][], agora: string): Evento[] {
  return linhas(rows).filter((c) => txt(c("ID_Event"))).map((c) => {
    const ref = txt(c("ID_Event")), p = parceiroDe(c("Partner Display"));
    return {
      ...eventoVazio(ref), nome: txt(c("Event Name")), tipo: txt(c("Type of Initiative")), objetivo: txt(c("Objective")),
      ambito: txt(c("Scope")), papel: txt(c("Role")), inicio: dataDe(c("Start Date")), fim: dataDe(c("End Date")), pais: txt(c("Country")),
      parceria: sim(c("Partnership")), parceiro: p.parceiro, parceiroRef: txt(c("ID_Partner")) || p.parceiroRef,
      patrocinio: sim(c("Sponsorship")), gasto: num(c("Budget Spent (€)")), valorPatrocinio: num(c("Sponsorship Value (€)")),
      observacoes: txt(c("Observations")), criadoEm: agora, atualizadoEm: agora,
    };
  });
}

const F_EUR = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const eur = (n: number | null | undefined) => (n === null || n === undefined ? "" : F_EUR.format(n));
const F_DATA = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
export const dataPt = (iso: string) => { if (!iso) return ""; const d = new Date(`${iso.slice(0, 10)}T12:00:00`); return isNaN(+d) ? "" : F_DATA.format(d); };

/** Cores das etiquetas (paleta terrosa da Sogrape). */
const P = { teal: "#2F6B73", plum: "#9B4D6B", wine: "#7A2338", green: "#4F7A3A", ochre: "#B07A12", rust: "#B15533", slate: "#5E6B7A", grey: "#94A3B8", indigo: "#3D4170" };
export const CORES: Record<string, string> = {
  // Must Win Battles
  "AI Excellence": P.teal, "Unforgettable Experiences": P.plum, "WineTech": P.wine, "Sustainable Futures": P.green, "New Packaging & Materials": P.ochre, "New Beverages": P.rust,
  // Tipos de evento
  "External Event": P.teal, "Internal Event": P.slate, "Scouting Event": P.rust, "Design Thinking Sandbox": P.plum, "Training": P.ochre, "Podcast": P.wine,
  // Papéis
  "Participant": P.grey, "Organizer": P.green, "Speaker": P.rust, "Jury": P.wine, "Challenger": P.ochre, "Mentor": P.teal, "Moderator": P.plum,
  // Objetivos
  "Ecosystem Positioning": P.teal, "Academia Positioning": P.indigo, "Knowledge Acquisition": P.ochre, "Knowledge Sharing": P.green, "Startup Scouting & Dealflow": P.rust,
  "Innovation Capabilities": P.plum, "Recognition": P.wine, "Community Engagement": P.slate,
  // Horizontes e relações
  "Incremental Innovation": P.green, "Transformational Innovation": P.ochre, "Disruptive Innovation": P.wine,
  "Startup": P.rust, "Academia": P.indigo, "Corporate": P.slate, "Accelerator": P.teal, "Other": P.grey,
  ...Object.fromEntries(ESTADOS_PROJ.map((e) => [e.id, e.cor])),
};
export const corDe = (v: string) => CORES[v] || P.grey;

/** Anos em que um projeto esteve ativo: do início (ou da discussão do piloto, ou da criação) até ao fim (ou até hoje). */
export function anosDoProjeto(p: Projeto): string[] {
  const hoje = new Date().getFullYear();
  const de = Number((p.inicio || p.pilotoDesde || p.criadoEm || "").slice(0, 4)) || hoje;
  const ate = Number(p.fim.slice(0, 4)) || Math.max(hoje, de);
  return Array.from({ length: Math.max(0, ate - de) + 1 }, (_, i) => String(de + i));
}
