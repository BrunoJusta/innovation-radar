/**
 * Importação do Excel do dealflow da FCR Sogrape Ventures (folha «Dealflow»): converte cada linha numa ficha do pipeline.
 * Só leitura e conversão; a gravação e a pesquisa dos sites ficam no componente de importação.
 */
import type { Celula } from "./xlsx-lite";
import { dataExcel } from "./xlsx-lite";
import type { Deal, Etapa, Fase, FaseDF, Interacao, MotivoArquivo, OrigemTipo, Startup, Vez, VerticalDF } from "./types";

/** Uma linha do Excel já convertida (ainda sem site nem cadeia de valor, que vêm da pesquisa). */
export type LinhaDF = {
  /** Posição no Excel (linha), para mensagens. */
  linha: number;
  ref: string; nome: string; fundadores: string; descricao: string; pais: string;
  vertical: VerticalDF | ""; fase: FaseDF | "";
  etapa: Etapa; interesse: Deal["interesse"]; vez: Vez | null;
  entrada: string; etapaDesde: string;
  ronda: Deal["ronda"]; origem: Deal["origem"];
  arquivo: Deal["arquivo"];
  notas: string;
  /** Texto original das colunas de estado, para a nota de importação. */
  estadoExcel: string;
};

// Colunas da folha Dealflow (a contar de 0: A = 0)
const C = { yref: 1, ref: 2, entrada: 3, nome: 4, fundadores: 5, status: 6, stage: 7, desc: 9, pais: 10, vertical: 11, fase: 12,
  valuation: 14, ronda: 15, ticket: 16, srcTipo: 18, src: 19, analise: 21, motivo: 22, decisao: 23, notas: 25 } as const;

const txt = (v: Celula | undefined) => (v === null || v === undefined ? "" : String(v)).trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Data numa célula: série do Excel ou texto dd/mm/aaaa. */
export function dataDe(v: Celula | undefined): string {
  if (typeof v === "number" && v > 20000 && v < 80000) return dataExcel(v);
  const t = txt(v), m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : "";
}

/** Valor em euros: "€4.0 M", "€ 350 k", "€4,5 M", 2000000, "$100 K". "N/D" ou vazio dá null. */
export function euros(v: Celula | undefined): number | null {
  if (typeof v === "number") return v > 0 ? v : null;
  const t = txt(v).replace(/\(.*$/, "");
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*([kKmM])?/);
  if (!m) return null;
  const n = Number(m[1].replace(",", ".")), u = (m[2] || "").toLowerCase();
  const val = u === "m" ? n * 1e6 : u === "k" ? n * 1e3 : n;
  return val > 0 ? Math.round(val) : null;
}

const VERT: Record<string, VerticalDF> = {
  viticulture: "viticultura", winemaking: "enologia", production: "producao", distribution: "distribuicao",
  "wine-related products": "produtos-vinho", "wine-related services": "servicos-vinho", "other strategic": "outro-estrategico", "other out of scope": "fora-ambito",
};
const FASE: Record<string, FaseDF> = {
  idea: "ideia", "pre-seed": "pre-seed", preseed: "pre-seed", seed: "seed", "series a": "serie-a", "serie a": "serie-a", "scale-up": "scale-up", growth: "crescimento", turnaround: "turnaround",
};

/** Fase da análise (coluna «Analysis phase») → fase do pipeline. */
function etapaDaAnalise(a: string): Etapa | null {
  const t = norm(a);
  if (!t || t.startsWith("archi")) return null;
  if (t.includes("negotiation") || t.includes("mou") || t.includes("investment agreement")) return "fecho";
  if (t.includes("deep") || t === "ic") return "aprofundada";
  if (t.includes("general analysis") || t.includes("beta") || t.includes("bc ")) return "geral";
  if (t.includes("fit") || t.includes("validation") || t.includes("screening")) return "fit";
  if (t.includes("reception")) return "fit";
  return null;
}

/** Deal stage (+ status e fase da análise) → fase do pipeline. */
function etapaDe(stage: string, status: string, analise: string): { etapa: Etapa; interesse: Deal["interesse"]; anterior: Etapa | null } {
  const s = norm(stage), st = norm(status), an = etapaDaAnalise(analise);
  if (s === "invested") return { etapa: "investida", interesse: "investimento", anterior: null };
  if (s === "archived" || (!s && st === "closed")) return { etapa: "arquivada", interesse: "investimento", anterior: an || "fit" };
  if (s.includes("non-investment")) return { etapa: "radar", interesse: "outro", anterior: null };
  if (s.includes("potential investment") || st === "watchlist") return { etapa: "radar", interesse: "investimento", anterior: null };
  if (s.includes("pre-screening")) return { etapa: "fit", interesse: "investimento", anterior: null };
  if (s.includes("screening") || s.includes("bc evaluation")) return { etapa: "geral", interesse: "investimento", anterior: null };
  return { etapa: an || "fit", interesse: "investimento", anterior: null };
}

const VEZ: Record<string, Vez> = { "holding startup feedback": "startup", "holding sogrape feedback": "sogrape", "holding beta feedback": "beta", "holding meeting": "reuniao" };

function origemDe(tipo: string, nome: string): Deal["origem"] {
  const t = norm(tipo), n = nome.trim(), all = `${t} ${norm(n)}`;
  let o: OrigemTipo = "outro";
  if (t === "application") o = "candidatura";
  else if (/partner|beta capital|collaboration/.test(all)) o = "parceiro";
  else if (/event|summit|expo|wine tech|conference|portfolio day|start to table|unicorn|demeter|hack|challenge/.test(all)) o = "evento";
  else if (/r&d|sogrape|^ic$|jpr|bbf|^ag$|linkedin|brisa|reccomendation|recommendation/.test(all) || /^(ic|ag|jpr|bbf)$/.test(t)) o = "rede";
  else if (/sourcing|soucing|scouting|organic|email/.test(t)) o = "pesquisa";
  return { tipo: o, nome: n || tipo.trim() || "Excel do dealflow", contacto: "" };
}

function motivoDe(texto: string): MotivoArquivo {
  const t = norm(texto);
  if (!t || t === "-") return "sem-registo";
  if (/valuation/.test(t)) return "valuation";
  if (/early|too soon|maturity|pre-revenue|prematur/.test(t)) return "early";
  if (/did not reply|no reply|no answer|not reply|no response|sem resposta|didn.t reply/.test(t)) return "sem-resposta";
  if (/committee|\bic\b/.test(t)) return "ic";
  if (/brand|marca/.test(t)) return "marca";
  if (/use case|caso de uso|pilot|application in/.test(t)) return "sem-caso-uso";
  if (/scope|strategic|alignment|focus|not core|fit/.test(t)) return "fora-ambito";
  if (/technolog|differentiat|propriet|roadmap/.test(t)) return "diferenciacao";
  if (/round|ticket|amount|fundraising|governance|conditions/.test(t)) return "ronda";
  return "outro";
}

/** Converte as linhas da folha Dealflow. Ignora o cabeçalho e as linhas sem nome. */
export function converterDealflow(linhas: Celula[][], hoje: string): LinhaDF[] {
  // O cabeçalho é a linha com «Project Name» na coluna E
  const h = linhas.findIndex((r) => norm(txt(r?.[C.nome])) === "project name");
  if (h < 0) throw new Error("Não encontrei o cabeçalho da folha Dealflow (coluna «Project Name»). Confirma que é o Excel do dealflow.");
  const out: LinhaDF[] = [];
  const refs = new Map<string, number>();
  linhas.slice(h + 1).forEach((r, k) => {
    const nome = txt(r?.[C.nome]);
    if (!nome || norm(nome) === "project name") return;
    const yref = txt(r[C.yref]).replace(/\D/g, "");
    let ref = yref.length >= 5 ? `${yref.slice(0, 4)}-${yref.slice(4)}` : txt(r[C.ref]) || `XL-${k + 1}`;
    // Referências repetidas no Excel ficam com uma letra a seguir
    const vezes = refs.get(ref) || 0; refs.set(ref, vezes + 1);
    if (vezes) ref = `${ref}-${String.fromCharCode(97 + vezes)}`;
    const status = txt(r[C.status]), stage = txt(r[C.stage]), analise = txt(r[C.analise]), motivo = txt(r[C.motivo]);
    const entrada = dataDe(r[C.entrada]) || hoje, decisao = dataDe(r[C.decisao]);
    const e = etapaDe(stage, status, analise);
    const lead = "";
    out.push({
      linha: h + 2 + k, ref, nome, fundadores: txt(r[C.fundadores]).replace(/\s*&\s*/g, " & "), descricao: txt(r[C.desc]), pais: txt(r[C.pais]),
      vertical: VERT[norm(txt(r[C.vertical]))] || "", fase: FASE[norm(txt(r[C.fase]))] || "",
      etapa: e.etapa, interesse: e.interesse,
      vez: e.etapa === "arquivada" || e.etapa === "investida" ? null : VEZ[norm(status)] || "sogrape",
      entrada, etapaDesde: (e.etapa === "arquivada" && decisao) || entrada,
      ronda: { valuation: euros(r[C.valuation]), valor: euros(r[C.ronda]), ticket: euros(r[C.ticket]), lead, coinvestidores: [],
        notas: [txt(r[C.valuation]), txt(r[C.ronda]), txt(r[C.ticket])].some((x) => x && x !== "N/D" && /\(|grant|\$/.test(x))
          ? `No Excel: valuation ${txt(r[C.valuation]) || "-"}, ronda ${txt(r[C.ronda]) || "-"}, ticket ${txt(r[C.ticket]) || "-"}` : "" },
      origem: origemDe(txt(r[C.srcTipo]), txt(r[C.src])),
      arquivo: e.etapa === "arquivada" ? { motivo: motivoDe(motivo), nota: motivo === "-" ? "" : motivo, em: decisao || entrada, etapaAnterior: e.anterior } : null,
      notas: txt(r[C.notas]) === "-" ? "" : txt(r[C.notas]),
      estadoExcel: [stage && `Deal stage: ${stage}`, status && `Status: ${status}`, analise && `Analysis phase: ${analise}`].filter(Boolean).join(" · "),
    });
  });
  return out;
}

/** Ficha do pipeline a partir de uma linha (o site e a cadeia de valor vêm da pesquisa). */
export function dealDaLinha(l: LinhaDF, extra: { site: string; dominio: string; cadeia: string; categoria?: string }, por: string, agora: string): Omit<Deal, "id"> {
  const ativa = l.etapa !== "arquivada" && l.etapa !== "investida";
  const passo = ativa ? [{ id: "xl1", texto: l.etapa === "radar" ? "Fazer o primeiro contacto" : "Rever o ponto de situação", vez: l.vez, prazo: null, responsavel: "", feito: null }] : [];
  return {
    ref: l.ref, nome: l.nome, site: extra.site, dominio: extra.dominio, fundadores: l.fundadores, descricao: l.descricao, pais: l.pais,
    vertical: l.vertical, fase: l.fase, cadeia: extra.cadeia || undefined, categoria: extra.categoria || undefined,
    etapa: l.etapa, etapaDesde: l.etapaDesde, interesse: l.interesse, entrada: l.entrada,
    vez: ativa ? l.vez : null, proximaAcao: passo[0]?.texto || "", prazo: null, responsavel: "", passos: passo,
    ronda: l.ronda, origem: l.origem, documentos: [], arquivo: l.arquivo,
    importado: true, criadoEm: agora, atualizadoEm: agora, criadoPor: por,
  };
}

/** Registos do histórico: a entrada no pipeline e as notas das reuniões do Excel. */
export function historicoDaLinha(l: LinhaDF): Omit<Interacao, "id">[] {
  const h: Omit<Interacao, "id">[] = [{ data: l.entrada, tipo: "etapa", texto: `Importada do Excel do dealflow (${l.estadoExcel || "sem estado"}).`, por: "Excel" }];
  if (l.arquivo?.nota) h.push({ data: l.arquivo.em, tipo: "etapa", texto: `Arquivada: ${l.arquivo.nota}`, por: "Excel" });
  if (l.notas) h.push({ data: l.entrada, tipo: "nota", texto: l.notas, por: "Excel" });
  return h;
}

/** Cadeia de valor pela vertical do Excel, quando a Gemini não conseguiu classificar (garante que nenhuma fica sem cadeia). */
const CADEIA_DA_VERTICAL: Record<string, string> = {
  viticultura: "viticultura", enologia: "enologia", producao: "producao", distribuicao: "vendas-distribuicao",
  "produtos-vinho": "adjacencias", "servicos-vinho": "consumidor", "outro-estrategico": "adjacencias", "fora-ambito": "adjacencias",
};
export const cadeiaPorDefeito = (l: Pick<LinhaDF, "vertical">) => CADEIA_DA_VERTICAL[l.vertical] || "adjacencias";

const FASE_RADAR: Record<string, Fase> = { ideia: "ideia", "pre-seed": "seed", seed: "seed", "serie-a": "serie-a", "scale-up": "crescimento", crescimento: "crescimento", turnaround: "crescimento" };
const slugId = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
/** Id da ficha no radar de startups: pelo domínio (como a recolha) ou, sem site, pelo nome. */
export const startupIdDe = (nome: string, dominio: string) => dominio ? dominio.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : `xl-${slugId(nome)}`;

/** Ficha no radar de startups para uma startup importada (aprovada e já ligada ao pipeline), para aparecer no anel da sua cadeia de valor. */
export function startupDaLinha(l: LinhaDF, extra: { site: string; dominio: string; cadeia: string; categoria?: string }, dealId: string, por: string, agora: string): Omit<Startup, "id"> {
  const r = l.ronda, eur = (n: number | null) => n == null ? "" : n >= 1e6 ? `${(n / 1e6).toLocaleString("pt-PT", { maximumFractionDigits: 2 })} M€` : `${Math.round(n / 1e3)} mil €`;
  return {
    status: "approved", nome: l.nome, site: extra.site, dominio: extra.dominio, pais: l.pais, fundacao: null,
    fase: FASE_RADAR[l.fase] || "seed", setor: extra.categoria || "", cadeia: extra.cadeia, descricao: l.descricao, porque: "",
    relevancia: 50, financiamento: r.valor ? `Ronda de ${eur(r.valor)}` : "", investidores: [],
    origens: [{ tipo: "manual", titulo: "Excel do dealflow da Sogrape Ventures", url: extra.site, data: agora }],
    destaque: false, manual: true, criadoPor: por, criadoEm: agora, atualizadoEm: agora, aprovadoEm: agora, aprovadoPor: por,
    dealId, pipelineEm: agora,
  };
}
