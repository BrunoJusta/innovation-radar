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
export interface Settings { corteRelevancia: number; janelaDias: number; }
export interface AppUser { email: string; nome?: string; role: Role; adicionadoEm?: string; adicionadoPor?: string; }

export interface RunSource {
  sourceId: string; nome: string; lidos: number; jaVistos: number; filtro: number;
  relevantes: number; novos: number; fundidos: number; erros: string[];
}
export interface Run { id: string; inicio: string; fim?: string; estado: "ok" | "erro" | "a correr"; fontes: RunSource[]; erroGeral?: string; }

export const DEFAULT_SETTINGS: Settings = { corteRelevancia: 50, janelaDias: 90 };
export const REJECT_REASONS = ["Fora de tema", "Pouco relevante", "Duplicada", "Fonte pouco fiável"];
export const AREA_COLORS = ["#7C3AED", "#0EA5DE", "#16C784", "#E7A912", "#E5487D", "#3D4170"];
