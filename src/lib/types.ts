export type Status = "pending" | "approved" | "rejected";
/** Separadores de triagem do backoffice. As rejeitadas são apagadas, por isso não têm separador. */
export type Fila = "pending" | "approved";
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
  /** Cadeia de valor (anel). */
  area: string;
  /** Temáticas, tecnologias e canais (ids de categories). */
  tags?: string[];
  /** Antes da taxonomia v2 havia uma só categoria. */
  categoria?: string;
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
  /** Cadeia de valor (anel): uma só. */
  area: string;
  /** Temáticas, tecnologias e canais (ids de categories): pelo menos uma temática. */
  tags?: string[];
  /** Antes da taxonomia v2 havia uma só categoria. */
  categoria?: string;
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

/** Cadeia de valor: um anel do radar. */
export interface Area { id: string; nome: string; descricao: string; cor: string; ordem: number; }
export type TipoTag = "tematica" | "tecnologia" | "canal";
export const TIPOS_TAG: { id: TipoTag; nome: string; plural: string }[] = [
  { id: "tematica", nome: "Temática", plural: "Temáticas" }, { id: "tecnologia", nome: "Tecnologia", plural: "Tecnologias" }, { id: "canal", nome: "Canal", plural: "Canais" },
];
/** Tag de uma notícia: temática, tecnologia ou canal. */
export interface Category {
  id: string; nome: string; icone: string; descricao: string; ordem: number;
  palavrasChave: string[];
  tipo?: TipoTag;
  /** Taxonomia antiga: anel a que a categoria pertencia. */
  area?: string | null;
}
/** Tags de uma notícia (ou da versão publicada), com as antigas de uma só categoria. */
export const tagsDe = (x: { tags?: string[]; categoria?: string } | null | undefined): string[] =>
  x?.tags?.length ? x.tags : x?.categoria ? [x.categoria] : [];
/** Tipo de uma tag (as categorias antigas, sem tipo, contam como temática). */
export const tipoDe = (c: Pick<Category, "tipo"> | undefined): TipoTag => c?.tipo || "tematica";
export interface Source {
  id: string; nome: string; tipo: "rss" | "wp-api"; url: string; lingua: "pt" | "en"; ativo: boolean;
  /** Onde a fonte é usada: recolha diária de notícias (por defeito) ou recolha semanal de startups. */
  para?: "noticias" | "startups";
  /** Grupo para organizar a lista de fontes (ex.: "Vinhos, espirituosos e bebidas"). */
  grupo?: string;
  /** Preenchido pela recolha quando o site bloqueia robôs; a fonte é desligada automaticamente. */
  bloqueado?: { em: string; por: "cloudflare"; http: number; url: string } | null;
}
export interface Settings {
  corteRelevancia: number; janelaDias: number; corteStartups?: number;
  /** Sites especializados a que a pesquisa de startups dá prioridade (domínios). */
  sitesStartups?: string[];
  /** A recolha semanal faz a análise de investimento às startups novas com relevância igual ou acima deste valor (0 desliga). */
  corteAnalise?: number;
  /** Versão da taxonomia instalada (2 = cadeias de valor e tags). */
  taxonomia?: number;
}
/** Sites de referência para a pesquisa de startups, usados enquanto não forem editados nas Definições. */
export const STARTUP_SITES = [
  "dealroom.co", "news.crunchbase.com", "agfundernews.com", "thespoon.tech", "foodhack.global",
  "eitfood.eu", "plugandplaytechcenter.com", "startus-insights.com",
];
/** Grupos sugeridos para as fontes de notícias. */
export const SOURCE_GROUPS = [
  "Vinhos, espirituosos e bebidas", "Tendências de consumo e inovação de produto", "Embalagem, materiais e sustentabilidade",
  "Experiência do consumidor, hotelaria e retalho", "Ciência e tecnologia",
];
export interface AppUser { email: string; nome?: string; role: Role; adicionadoEm?: string; adicionadoPor?: string; }

export interface RunSource {
  sourceId: string; nome: string; lidos: number; jaVistos: number; filtro: number;
  relevantes: number; novos: number; fundidos: number; erros: string[];
}
export interface Run { id: string; tipo?: "startups"; inicio: string; fim?: string; estado: "ok" | "erro" | "a correr"; fontes: RunSource[]; erroGeral?: string;
  /** Migração para a taxonomia v2: notícias reclassificadas nesta execução. */
  reclassificacao?: { feitas: number; tentadas: number; faltam: number; erros: string[] }; rejeitadasApagadas?: number; }

export const DEFAULT_SETTINGS: Settings = { corteRelevancia: 50, janelaDias: 90, corteStartups: 50, sitesStartups: STARTUP_SITES, corteAnalise: 75 };
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
  /** Nomes que a startup já teve (quando muda de nome). */
  nomesAnteriores?: string[];
  pais: string; cidade?: string; fundacao: number | null;
  fase: Fase; setor: string;
  /** Cadeia de valor (anel do radar de startups), id de areas. */
  cadeia?: string;
  /** Logótipo (data URL pequeno, procurado no site ou carregado à mão). */
  logo?: string;
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
  /** Resumo da última análise de investimento (a análise completa fica em startups/{id}/analises). */
  analiseResumo?: AnaliseResumo;
  /** Ficha no pipeline, quando passou para lá (sai da lista de Aprovadas, mas continua aprovada). */
  dealId?: string; pipelineEm?: string;
  /** Próximos passos em aberto quando saiu do pipeline: ficam em espera e voltam se a startup regressar ao pipeline. */
  passosEmEspera?: PassosEmEspera | null;
}
export interface PassosEmEspera { passos: Passo[]; desde: string; etapa: string; ref?: string }

/* ---------- Análise de investimento (Sogrape Ventures) ---------- */

export type Veredicto = "positivo" | "negativo" | "incerto";
/** Decisão da análise: investir, não investir ou incerto (bom encaixe, mas faltam dados para decidir, por exemplo financeiros). */
export type Decisao = "investir" | "nao-investir" | "incerto";
export const DECISOES: Record<Decisao, { nome: string; curto: string }> = {
  investir: { nome: "Investir", curto: "Investir" }, "nao-investir": { nome: "Não investir", curto: "Não" }, incerto: { nome: "Incerto", curto: "Incerto" },
};
export const nomeDecisao = (d: string | undefined | null) => (d && d in DECISOES ? DECISOES[d as Decisao].nome : "");
export const VEREDICTOS: Record<Veredicto, { nome: string; icon: string }> = {
  positivo: { nome: "Positivo", icon: "check" }, negativo: { nome: "Negativo", icon: "x" }, incerto: { nome: "Incerto", icon: "question" },
};

export type Vertical = "viticultura" | "enologia" | "producao" | "marketing" | "vendas-distribuicao" | "adjacencias";
export const VERTICAIS: { id: Vertical; nome: string }[] = [
  { id: "viticultura", nome: "Viticultura" }, { id: "enologia", nome: "Enologia" }, { id: "producao", nome: "Produção" },
  { id: "marketing", nome: "Marketing" }, { id: "vendas-distribuicao", nome: "Vendas e distribuição" }, { id: "adjacencias", nome: "Adjacências" },
];

export type Ciclo = "mvp" | "pre-seed" | "seed" | "pre-serie-a" | "serie-a" | "serie-b" | "serie-c" | "na";
export const CICLOS: { id: Ciclo; nome: string; desc: string }[] = [
  { id: "mvp", nome: "MVP", desc: "Sem receita, menos de 1 ano" }, { id: "pre-seed", nome: "Pre-Seed", desc: "Até 100 mil €" },
  { id: "seed", nome: "Seed", desc: "100 mil € a 1 M€" }, { id: "pre-serie-a", nome: "Pre-Série A", desc: "Entre seed e série A" },
  { id: "serie-a", nome: "Série A", desc: "1 M€ a 10 M€" }, { id: "serie-b", nome: "Série B", desc: "10 M€ a 25 M€" },
  { id: "serie-c", nome: "Série C ou mais", desc: "Mais de 25 M€" }, { id: "na", nome: "Não aplicável", desc: "" },
];

export type Ticket = "ate-100k" | "100-200k" | "mais-200k";
export const TICKETS: { id: Ticket; nome: string }[] = [
  { id: "ate-100k", nome: "Até 100 mil €" }, { id: "100-200k", nome: "100 a 200 mil €" }, { id: "mais-200k", nome: "Mais de 200 mil €" },
];

export type CriterioId = "ambito" | "aplicabilidade" | "problema" | "casoUso" | "transferencia" | "equipa" | "marca" | "plano" | "tracao" | "ronda" | "geografia";
export type GrupoCriterio = "encaixe" | "empresa" | "investimento";
export const GRUPOS_CRITERIOS: { id: GrupoCriterio; nome: string; desc: string }[] = [
  { id: "encaixe", nome: "Encaixe estratégico", desc: "Ligação ao vinho e utilidade para a Sogrape" },
  { id: "empresa", nome: "Equipa e negócio", desc: "Quem são e se o modelo se aguenta" },
  { id: "investimento", nome: "Tração e investimento", desc: "Provas de mercado, ronda e geografia" },
];
/** Os 11 critérios das guidelines de investimento, arrumados em 3 grupos. */
export const CRITERIOS: { id: CriterioId; grupo: GrupoCriterio; nome: string; pergunta: string }[] = [
  { id: "ambito", grupo: "encaixe", nome: "Âmbito estratégico", pergunta: "Está ligada à cadeia de valor do vinho (viticultura, enologia, produção, cadeia de abastecimento, vendas e marketing) ou é uma adjacência com transferência credível?" },
  { id: "aplicabilidade", grupo: "encaixe", nome: "Aplicabilidade ao vinho", pergunta: "Resolve um problema concreto do setor do vinho? Soluções genéricas (por exemplo RH) são negativas; soluções transversais de supply chain, DTC ou marketing só contam com caso de uso ou pipeline no vinho." },
  { id: "problema", grupo: "encaixe", nome: "Relevância do problema", pergunta: "O problema é importante para a Sogrape ou para a cadeia de valor do vinho?" },
  { id: "casoUso", grupo: "encaixe", nome: "Caso de uso para a Sogrape", pergunta: "Há um caso de uso claro, detalhado e acionável na Sogrape?" },
  { id: "transferencia", grupo: "encaixe", nome: "Plano de transferência para o vinho", pergunta: "Se não nasceu no vinho, há um plano credível para chegar à vinha ou à adega em 6 a 12 meses, com marcos técnicos? Se já é do vinho, é positivo." },
  { id: "equipa", grupo: "empresa", nome: "Equipa e fundadores", pergunta: "Conhecimento do domínio, capacidade de aprender e adaptar-se, credibilidade e abertura a coaching." },
  { id: "marca", grupo: "empresa", nome: "Risco de marca", pergunta: "É uma startup de marca pura, que exige capital pesado e recorrente? Se sim, é negativo, salvo tecnologia inovadora alinhada com a estratégia (ex.: no/low com tecnologia própria)." },
  { id: "plano", grupo: "empresa", nome: "Plano de negócio", pergunta: "Go-to-market claro, lógica financeira, marcos definidos e escalabilidade." },
  { id: "tracao", grupo: "investimento", nome: "Tração", pergunta: "Receita, clientes pagantes e pilotos (idealmente no vinho e em vários locais)." },
  { id: "ronda", grupo: "investimento", nome: "Ronda e coinvestidores", pergunta: "A valorização e o tamanho da ronda permitem à Sogrape ser um minoritário relevante? Há coinvestidores credíveis?" },
  { id: "geografia", grupo: "investimento", nome: "Geografia", pergunta: "Presença na UE (prioridade a Portugal, França, Itália, Alemanha, Espanha e Reino Unido) ou ligação forte à Europa (equipa, clientes, pilotos, plano de entrada)." },
];
/**
 * Matriz das guidelines: que critérios contam em cada ticket.
 * 0 = não conta, 1 = conta ("must meet most"), 2 = obrigatório ("must meet").
 */
export const MATRIZ: { nome: string; criterio: CriterioId; peso: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] }[] = [
  { nome: "Equipa e fundadores", criterio: "equipa", peso: [1, 1, 2] },
  { nome: "Relevância do problema", criterio: "problema", peso: [1, 1, 2] },
  { nome: "Plano de transferência para o vinho", criterio: "transferencia", peso: [1, 1, 2] },
  { nome: "Tração e receita", criterio: "tracao", peso: [0, 1, 2] },
  { nome: "Valorização e tamanho da ronda", criterio: "ronda", peso: [0, 1, 2] },
  { nome: "Caso de uso detalhado", criterio: "casoUso", peso: [0, 1, 2] },
  { nome: "Plano de negócio robusto", criterio: "plano", peso: [0, 1, 2] },
  { nome: "Geografia (global, foco em Portugal e UE)", criterio: "geografia", peso: [1, 1, 1] },
];

export interface AnaliseFonte { titulo: string; url: string }
export interface AnalisePerfil {
  resumo: string; vertical: Vertical; ciclo: Ciclo; fundacao: string;
  produto: string; clientesAlvo: string; modeloNegocio: string; tecnologia: string; cadeiaValor: string;
  sede: string; mercados: string;
  tracao: { receita: string; clientes: string; pilotos: string };
  equipa: { nome: string; cargo: string; percurso: string }[];
  financiamento: { totalEur: number | null; procura: "sim" | "nao" | "desconhecido"; rondaAtualEur: number | null; rondas: string[]; investidores: string[] };
  emFalta: string[];
}
export interface AnaliseCriterio { id: CriterioId; veredicto: Veredicto; justificacao: string; fontes: string[] }
export interface Analise {
  id?: string;
  feitaEm: string; por: string; modelo: string;
  perfil: AnalisePerfil;
  criterios: AnaliseCriterio[];
  /** Desafio de 2026 das guidelines a que a startup responde, ou "". */
  desafio: string;
  forcas: string[]; riscos: string[]; emFalta: string[];
  decisao: Decisao; condicoes: string; racional: string;
  ticket: Ticket | null; ticketRacional: string;
  followOn: boolean; followOnRacional: string;
  encaixe: string; proximosPassos: string[];
  fontes: AnaliseFonte[];
  /** Versão editada à mão (sem nova pesquisa nem avaliação da Gemini). */
  editada?: boolean;
  /** Documentos juntados à análise (só os nomes; o conteúdo não fica guardado). */
  documentos?: string[];
}
export interface AnaliseResumo { decisao: Analise["decisao"]; ticket: Ticket | null; desafio: string; positivos: number; feitaEm: string; negativos?: CriterioId[]; incertos?: CriterioId[] }

/* ---------- Pipeline (dealflow da Sogrape Ventures) ---------- */

export type Etapa = "fit" | "geral" | "aprofundada" | "comite" | "fecho" | "radar" | "investida" | "arquivada";
/** Fases do pipeline, pela ordem do processo, seguidas dos três destinos finais (radar, investida, arquivada). */
export const ETAPAS: { id: Etapa; nome: string; desc: string }[] = [
  { id: "fit", nome: "Validation Fit", desc: "A Sogrape valida o encaixe estratégico e o caso de uso" },
  { id: "geral", nome: "General Analysis", desc: "Análise geral (com a Beta Capital)" },
  { id: "aprofundada", nome: "Deep Analysis", desc: "Análise aprofundada e due diligence" },
  { id: "comite", nome: "Investment Committee", desc: "Decisão do comité de investimento" },
  { id: "fecho", nome: "Closing Stage", desc: "MoU, acordo de investimento e fecho" },
  { id: "radar", nome: "Radar", desc: "Fica no radar: interesse sem investimento agora (acompanhar, piloto, parceria)" },
  { id: "investida", nome: "Investida", desc: "No portefólio" },
  { id: "arquivada", nome: "Arquivada", desc: "Processo terminado" },
];
/** As fases em curso (as colunas do quadro). */
export const ETAPAS_ATIVAS = ETAPAS.filter((e) => !["radar", "investida", "arquivada"].includes(e.id));
/** Os três destinos finais. */
export const ETAPAS_FINAIS = (["investida", "radar", "arquivada"] as Etapa[]).map((id) => ETAPAS.find((e) => e.id === id)!);
export const emCurso = (e: string) => ETAPAS_ATIVAS.some((x) => x.id === e);
/** Fases da versão anterior → fases atuais (para fichas antigas e para a migração). */
export const ETAPA_ANTIGA: Record<string, Etapa> = { contacto: "fit", "analise-bc": "geral", negociacao: "fecho" };
export const etapaAtual = (e: string | null | undefined): Etapa => (ETAPA_ANTIGA[e || ""] || e || "fit") as Etapa;

export type Vez = "startup" | "sogrape" | "beta" | "reuniao";
export const VEZES: { id: Vez; nome: string; curto: string }[] = [
  { id: "sogrape", nome: "Do lado da Sogrape", curto: "Sogrape" },
  { id: "startup", nome: "À espera da startup", curto: "Startup" },
  { id: "beta", nome: "À espera da Beta Capital", curto: "Beta Capital" },
  { id: "reuniao", nome: "Reunião por marcar", curto: "Reunião" },
];

export type VerticalDF = "viticultura" | "enologia" | "producao" | "distribuicao" | "produtos-vinho" | "servicos-vinho" | "outro-estrategico" | "fora-ambito";
export const VERTICAIS_DF: { id: VerticalDF; nome: string }[] = [
  { id: "viticultura", nome: "Viticultura" }, { id: "enologia", nome: "Enologia" }, { id: "producao", nome: "Produção" },
  { id: "distribuicao", nome: "Distribuição" }, { id: "produtos-vinho", nome: "Produtos ligados ao vinho" }, { id: "servicos-vinho", nome: "Serviços ligados ao vinho" },
  { id: "outro-estrategico", nome: "Outro estratégico" }, { id: "fora-ambito", nome: "Fora de âmbito" },
];
export type FaseDF = "ideia" | "pre-seed" | "seed" | "serie-a" | "scale-up" | "crescimento" | "turnaround";
export const FASES_DF: { id: FaseDF; nome: string }[] = [
  { id: "ideia", nome: "Ideia" }, { id: "pre-seed", nome: "Pre-seed" }, { id: "seed", nome: "Seed" }, { id: "serie-a", nome: "Série A" },
  { id: "scale-up", nome: "Scale-up" }, { id: "crescimento", nome: "Crescimento" }, { id: "turnaround", nome: "Turnaround" },
];
export type OrigemTipo = "candidatura" | "parceiro" | "evento" | "pesquisa" | "rede" | "radar" | "outro";
export const ORIGENS_DF: { id: OrigemTipo; nome: string }[] = [
  { id: "candidatura", nome: "Candidatura" }, { id: "parceiro", nome: "Parceiro" }, { id: "evento", nome: "Evento" },
  { id: "pesquisa", nome: "Pesquisa ativa" }, { id: "rede", nome: "Rede interna" }, { id: "radar", nome: "Radar de startups" }, { id: "outro", nome: "Outro" },
];
export type MotivoArquivo = "sem-caso-uso" | "fora-ambito" | "early" | "ronda" | "valuation" | "diferenciacao" | "marca" | "sem-resposta" | "ic" | "sem-registo" | "outro";
export const MOTIVOS_ARQUIVO: { id: MotivoArquivo; nome: string }[] = [
  { id: "sem-caso-uso", nome: "Sem caso de uso" }, { id: "fora-ambito", nome: "Fora de âmbito ou sem alinhamento estratégico" },
  { id: "early", nome: "Demasiado early-stage" }, { id: "ronda", nome: "Ronda, montante ou condições" }, { id: "valuation", nome: "Valuation" },
  { id: "diferenciacao", nome: "Baixa diferenciação ou tecnologia incerta" }, { id: "marca", nome: "Marca pura" },
  { id: "sem-resposta", nome: "Sem resposta ou sem informação" }, { id: "ic", nome: "Rejeitada no comité" },
  { id: "sem-registo", nome: "Sem motivo registado" }, { id: "outro", nome: "Outro" },
];
export type TipoInteracao = "reuniao" | "email" | "documento" | "nota" | "feedback-bc" | "etapa";
export const TIPOS_INTERACAO: { id: TipoInteracao; nome: string; icon: string }[] = [
  { id: "reuniao", nome: "Reunião", icon: "users" }, { id: "email", nome: "Email", icon: "tray" }, { id: "documento", nome: "Documento", icon: "stack" },
  { id: "feedback-bc", nome: "Feedback Beta Capital", icon: "briefcase" }, { id: "nota", nome: "Nota", icon: "pencil-simple" }, { id: "etapa", nome: "Mudança de fase", icon: "arrow-up-right" },
];

/** Um próximo passo de uma startup do pipeline. Uma startup pode ter vários em aberto ao mesmo tempo. */
export interface Passo { id: string; texto: string; vez: Vez | null; prazo: string | null; responsavel: string; feito?: string | null; feitoPor?: string }

export interface Deal {
  id: string; ref: string;
  nome: string; site: string; dominio: string; fundadores: string;
  /** Nomes que a startup já teve (quando muda de nome). */
  nomesAnteriores?: string[];
  descricao: string; pais: string;
  vertical: VerticalDF | ""; fase: FaseDF | "";
  /** Cadeia de valor (id de areas). */
  cadeia?: string;
  /** Categoria, o tipo de solução (id de sectors). */
  categoria?: string;
  /** Logótipo (data URL pequeno). */
  logo?: string;
  etapa: Etapa; etapaDesde: string;
  /** Interesse quando está no radar: investimento ou outro tipo de relação (piloto, parceria). */
  interesse: "investimento" | "outro";
  entrada: string;
  vez: Vez | null; proximaAcao: string; prazo: string | null; responsavel: string;
  /** Lista de próximos passos. Os campos vez, proximaAcao, prazo e responsavel guardam sempre o passo em aberto mais urgente. */
  passos?: Passo[];
  ronda: { valuation: number | null; valor: number | null; ticket: number | null; lead: string; coinvestidores: string[]; notas: string };
  origem: { tipo: OrigemTipo; nome: string; contacto: string };
  documentos: { titulo: string; url: string }[];
  arquivo?: { motivo: MotivoArquivo; nota: string; em: string; etapaAnterior: Etapa | null } | null;
  /** Fase em curso de onde saiu para o radar ou para as investidas (para reabrir e para o funil). */
  etapaAnterior?: Etapa | null;
  /** Ficha no radar de startups, quando existe. */
  startupId?: string;
  analiseResumo?: AnaliseResumo;
  importado?: boolean;
  criadoEm: string; atualizadoEm: string; criadoPor?: string;
}
export interface Interacao { id: string; data: string; tipo: TipoInteracao; texto: string; participantes?: string; links?: { titulo: string; url: string }[]; por?: string; criadoEm?: string }
