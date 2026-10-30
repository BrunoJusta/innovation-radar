/**
 * Onde está cada coisa no backoffice: a localização de uma página (para os breadcrumbs e o histórico)
 * e a localização de uma startup, de um projeto ou de um evento (para a pesquisa global).
 */
import { Deal, ETAPAS, Startup, emCurso } from "./types";
import { ONGOING, type Evento, type Projeto, estadoNorm } from "./inovacao";

export type View = "dashboard" | "news" | "startups" | "projetos" | "eventos" | "settings";
export type StartupPage = "pending" | "rejected" | "approved" | "radar" | "pipeline" | "review";
export type PipeEstado = "ativas" | "investidas" | "radar" | "arquivadas";
/** Item a abrir quando se chega à página (vem da pesquisa global): a lista fica filtrada pelo nome e a ficha aberta. */
export type Foco = { id: string; nome: string };
/** Uma página do backoffice. */
export type Loc = { view: View; news?: "pending" | "approved" | "radar"; st?: StartupPage; pipe?: PipeEstado; proj?: string; foco?: Foco };

/** Tira os campos que não pertencem à página (ex.: o separador do pipeline fora do pipeline). */
export function normLoc(l: Loc): Loc {
  const o: Loc = { view: l.view };
  if (l.view === "news") o.news = l.news || "pending";
  if (l.view === "startups") { o.st = l.st || "pending"; if (o.st === "pipeline") o.pipe = l.pipe || "ativas"; }
  if (l.view === "projetos") o.proj = l.proj || ONGOING;
  if (l.foco) o.foco = l.foco;
  return o;
}
export const mesmaLoc = (a: Loc, b: Loc) => JSON.stringify(normLoc(a)) === JSON.stringify(normLoc(b));

const NEWS = { pending: "Triagem", approved: "Aprovadas", radar: "Radar" } as const;
const PIPE: Record<PipeEstado, string> = { ativas: "Em curso", investidas: "Investidas", radar: "Radar", arquivadas: "Arquivo" };

/** Breadcrumbs de uma página: cada nível leva à página desse nível (sem o item aberto). */
export function crumbsDe(l0: Loc): { label: string; to: Loc | null }[] {
  const l = normLoc(l0);
  const c: { label: string; to: Loc | null }[] = [];
  switch (l.view) {
    case "dashboard": c.push({ label: "Dashboard", to: { view: "dashboard" } }); break;
    case "settings": c.push({ label: "Definições", to: { view: "settings" } }); break;
    case "eventos": c.push({ label: "Eventos", to: { view: "eventos" } }); break;
    case "projetos": c.push({ label: "Projetos", to: { view: "projetos" } }, { label: l.proj!, to: { view: "projetos", proj: l.proj } }); break;
    case "news": c.push({ label: "Notícias", to: { view: "news" } }, { label: NEWS[l.news!], to: { view: "news", news: l.news } }); break;
    case "startups": {
      c.push({ label: "Startups", to: { view: "startups" } });
      const st = l.st!;
      if (st === "pending" || st === "rejected") c.push({ label: "Triagem", to: { view: "startups", st: "pending" } });
      if (st === "rejected") c.push({ label: "Arquivo de triagem", to: { view: "startups", st: "rejected" } });
      if (st === "approved") c.push({ label: "Aprovadas", to: { view: "startups", st } });
      if (st === "radar") c.push({ label: "Radar", to: { view: "startups", st } });
      if (st === "review") c.push({ label: "Review", to: { view: "startups", st } });
      if (st === "pipeline") c.push({ label: "Pipeline", to: { view: "startups", st } }, { label: PIPE[l.pipe!], to: { view: "startups", st, pipe: l.pipe } });
      break;
    }
  }
  if (l.foco) c.push({ label: l.foco.nome, to: null });
  return c;
}

/* ---------- Localização de cada item (pesquisa global) ---------- */

export type Achado = { tipo: "startup" | "projeto" | "evento"; id: string; nome: string; sub: string; onde: string[]; loc: Loc };

export const pipeEstadoDe = (etapa: string): PipeEstado => emCurso(etapa) ? "ativas" : etapa === "investida" ? "investidas" : etapa === "radar" ? "radar" : "arquivadas";

/** Startup no pipeline: em curso (com a fase), investidas, radar ou arquivo. */
export function ondeDeal(d: Pick<Deal, "etapa">): string[] {
  const e = pipeEstadoDe(d.etapa);
  return ["Pipeline", e === "ativas" ? ETAPAS.find((x) => x.id === d.etapa)?.nome || "Em curso" : PIPE[e]];
}
/** Startup fora do pipeline: triagem, arquivo de triagem ou aprovadas. */
export function ondeStartup(s: Pick<Startup, "status">): string[] {
  return s.status === "pending" ? ["Triagem"] : s.status === "rejected" ? ["Triagem", "Arquivo"] : ["Aprovadas"];
}
export const locDeal = (d: Pick<Deal, "id" | "nome" | "etapa">): Loc => ({ view: "startups", st: "pipeline", pipe: pipeEstadoDe(d.etapa), foco: { id: d.id, nome: d.nome.trim() } });
export const locStartup = (s: Pick<Startup, "id" | "nome" | "status">): Loc => ({ view: "startups", st: s.status, foco: { id: s.id, nome: s.nome.trim() } });

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Pesquisa em startups (triagem, aprovadas e pipeline), projetos e eventos. Uma startup no pipeline aparece uma só vez,
 * com a localização do pipeline. Sem acesso ao pipeline (deals vazio), as que lá estão levam ao radar de startups.
 */
export function pesquisar(q0: string, { startups, deals, projetos, eventos, pipeline }: {
  startups: Startup[]; deals: Deal[]; projetos: Projeto[]; eventos: Evento[]; pipeline: boolean;
}, max = 14): Achado[] {
  const q = norm(q0);
  if (q.length < 2) return [];
  const out: (Achado & { r: number })[] = [];
  const rank = (nome: string, extra: string) => { const n = norm(nome); return n === q ? 0 : n.startsWith(q) ? 1 : n.split(/[^a-z0-9]+/).some((w) => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : norm(extra).includes(q) ? 4 : -1; };
  const usados = new Set<string>();
  for (const d of deals) {
    const r = rank(d.nome, `${d.ref} ${d.dominio} ${d.pais} ${(d.nomesAnteriores || []).join(" ")}`);
    if (d.startupId) usados.add(d.startupId);
    if (r < 0) continue;
    out.push({ tipo: "startup", id: d.id, nome: d.nome.trim(), sub: [d.dominio, d.pais].filter(Boolean).join(" · "), onde: ondeDeal(d), loc: locDeal(d), r });
  }
  const nomesDeals = new Set(deals.map((d) => norm(d.nome)));
  for (const s of startups) {
    if (usados.has(s.id) || (s.dealId && pipeline) || nomesDeals.has(norm(s.nome))) continue;
    const r = rank(s.nome, `${s.dominio} ${s.pais} ${(s.nomesAnteriores || []).join(" ")}`);
    if (r < 0) continue;
    // Quem não vê o pipeline vai para o radar de startups
    const noPipe = !!s.dealId && !pipeline;
    out.push({ tipo: "startup", id: s.id, nome: s.nome.trim(), sub: [s.dominio, s.pais].filter(Boolean).join(" · "), onde: noPipe ? ["Pipeline"] : ondeStartup(s),
      loc: noPipe ? { view: "startups", st: "radar" } : locStartup(s), r });
  }
  for (const p of projetos) {
    const r = rank(p.nome, `${p.ref} ${p.parceiro}`);
    if (r < 0) continue;
    const e = estadoNorm(p.estado);
    out.push({ tipo: "projeto", id: p.id, nome: p.nome, sub: [p.ref, p.parceiro].filter(Boolean).join(" · "), onde: ["Projetos", e, ...(e === ONGOING && p.fase ? [p.fase] : [])],
      loc: { view: "projetos", proj: e, foco: { id: p.id, nome: p.nome } }, r });
  }
  for (const e of eventos) {
    const r = rank(e.nome, `${e.ref} ${e.parceiro} ${e.pais}`);
    if (r < 0) continue;
    out.push({ tipo: "evento", id: e.id, nome: e.nome, sub: [e.ref, e.pais].filter(Boolean).join(" · "), onde: ["Eventos", ...(e.inicio ? [e.inicio.slice(0, 4)] : [])],
      loc: { view: "eventos", foco: { id: e.id, nome: e.nome } }, r });
  }
  return out.sort((a, b) => a.r - b.r || a.nome.localeCompare(b.nome)).slice(0, max).map(({ r: _r, ...x }) => x); // eslint-disable-line @typescript-eslint/no-unused-vars
}
