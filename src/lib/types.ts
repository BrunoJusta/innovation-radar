export type Status = "pending" | "approved" | "rejected";
export type Role = "admin" | "editor";

export interface Fonte {
  site: string;
  sourceId: string;
  url: string;
  urlHash: string;
  tituloOriginal: string;
  data: string; // ISO, data de publicação do artigo
  autor?: string;
}

/** Versão que aparece no radar público (fotografia tirada no momento da aprovação). */
export interface Publicado {
  titulo: string;
  resumo: string;
  area: string;
  categoria: string;
  entidades: string[];
  fontes: { titulo: string; url: string }[];
  dataPublicacao: string;
  relevancia: number;
  destaque: boolean;
}

export interface Signal {
  id: string;
  status: Status;
  titulo: string;
  resumo: string;
  porque: string;
  entidades: string[];
  area: string;
  categoria: string;
  relevancia: number;
  destaque: boolean;
  fontes: Fonte[];
  dataPublicacao: string;
  criadoEm: string;
  atualizadoEm: string;
  motivoRejeicao?: string;
  flagNovaFonte?: boolean;
  noRadar: boolean;
  publicado?: Publicado | null;
  aprovadoEm?: string;
  aprovadoPor?: string;
  manual?: boolean;      // adicionada à mão a partir de um link
  criadoPor?: string;
}

export interface Area { id: string; nome: string; descricao: string; cor: string; ordem: number; }
export interface Category {
  id: string; nome: string; icone: string; descricao: string; ordem: number;
  palavrasChave: string[];
}
export interface Source {
  id: string; nome: string; tipo: "rss" | "wp-api"; url: string; lingua: "pt" | "en"; ativo: boolean;
  /** Preenchido pela recolha quando o site bloqueia robôs; a fonte é desligada automaticamente. */
  bloqueado?: { em: string; por: "cloudflare"; http: number; url: string } | null;
}
export interface Settings { corteRelevancia: number; janelaDias: number; corteStartups?: number; }
export interface AppUser { email: string; nome?: string; role: Role; adicionadoEm?: string; adicionadoPor?: string; }

export interface RunSource {
  sourceId: string; nome: string; lidos: number; jaVistos: number; filtro: number;
  relevantes: number; novos: number; fundidos: number; erros: string[];
}
export interface Run { id: string; tipo?: "startups"; inicio: string; fim?: string; estado: "ok" | "erro" | "a correr"; fontes: RunSource[]; erroGeral?: string; }

export const DEFAULT_SETTINGS: Settings = { corteRelevancia: 50, janelaDias: 90, corteStartups: 50 };
export const REJECT_REASONS = ["Fora de tema", "Pouco relevante", "Duplicada", "Fonte pouco fiável"];
export const AREA_COLORS = ["#7C3AED", "#0EA5DE", "#16C784", "#E7A912", "#E5487D", "#3D4170"];

/* ---------- Startups ---------- */

export type Fase = "crescimento" | "serie-a" | "seed" | "ideia";
/** Fases das startups (filtro no radar de startups e campo da ficha), da mais madura para a mais jovem. */
export const FASES: { id: Fase; nome: string; cor: string; descricao: string }[] = [
  { id: "crescimento", nome: "Crescimento", cor: "#24375E", descricao: "Série B ou mais, ou receita e clientes estabelecidos." },
  { id: "serie-a", nome: "Série A", cor: "#3E5C8A", descricao: "Produto no mercado e primeira ronda institucional." },
  { id: "seed", nome: "Seed", cor: "#5A7AA6", descricao: "Primeiros clientes, ronda seed ou pré-seed." },
  { id: "ideia", nome: "Ideia", cor: "#7A8FAE", descricao: "Protótipo, piloto ou ainda sem investimento." },
];

export interface Sector {
  id: string; nome: string; cor: string; icone: string; descricao: string; ordem: number;
  /** Pesquisas online que a recolha semanal corre para este setor (PT e EN). */
  pesquisas: string[];
}

export interface StartupOrigem {
  tipo: "pesquisa" | "noticia" | "manual";
  titulo: string; url: string; data: string;
  pesquisa?: string;
}

export interface Startup {
  id: string;            // derivado do domínio do site (evita duplicados)
  status: Status;
  nome: string; site: string; dominio: string;
  pais: string; cidade?: string; fundacao: number | null;
  fase: Fase; setor: string;
  descricao: string;     // o que faz, pt-PT
  porque: string;        // porque interessa à Sogrape
  relevancia: number;
  financiamento: string; // texto livre, por exemplo "2,5 M€ seed (2025)"
  investidores: string[];
  origens: StartupOrigem[];
  destaque: boolean;
  criadoEm: string; atualizadoEm: string;
  motivoRejeicao?: string; aprovadoEm?: string; aprovadoPor?: string;
  manual?: boolean; criadoPor?: string;
  flagNovaInfo?: boolean;
}
