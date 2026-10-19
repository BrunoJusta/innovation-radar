/**
 * Categorias das startups (versão 2): o tipo de solução, que cruza com a cadeia de valor (os anéis do radar).
 * Guardadas na coleção «sectors» (o campo da startup continua a chamar-se «setor»).
 * Cada categoria tem as pesquisas que a recolha semanal corre.
 */
export const CATEGORIAS_VERSAO = 2;

type Cat = { nome: string; cor: string; icone: string; ordem: number; descricao: string; pesquisas: string[] };

export const CATEGORIAS_V2: Record<string, Cat> = {
  "dados-ia-software": { nome: "Dados, IA e software", cor: "#0EA5DE", icone: "chart-line", ordem: 1,
    descricao: "Software e inteligência artificial: gestão de adega e de vinha, previsão de procura, análise de dados, preços, recomendação e assistentes com IA.",
    pesquisas: ["AI startup wine industry", "winery management software startup", "AI demand forecasting startup beverage", "startup inteligência artificial vinho"] },
  "sensores-precisao": { nome: "Sensores e agricultura de precisão", cor: "#16A34A", icone: "leaf", ordem: 2,
    descricao: "Sensores, IoT, imagem de satélite e drones para a vinha e a adega: clima, solo, rega, doenças, maturação e qualidade da uva.",
    pesquisas: ["vineyard precision agriculture startup", "vineyard sensor IoT startup funding", "grape quality sensing startup", "satellite imaging vineyard startup"] },
  "robotica-automacao": { nome: "Robótica e automação", cor: "#64748B", icone: "gear", ordem: 3,
    descricao: "Robôs e máquinas autónomas para a vinha (poda, vindima, tratamentos) e automação da adega e das linhas de enchimento.",
    pesquisas: ["viticulture robotics startup funding", "autonomous vineyard robot startup", "winery automation startup", "robótica vinha startup"] },
  "biotecnologia": { nome: "Biotecnologia e ciência", cor: "#7C3AED", icone: "flask", ordem: 4,
    descricao: "Leveduras e fermentação, biocontrolo e bioestimulantes, proteção contra geada e doenças, novos ingredientes e processos científicos.",
    pesquisas: ["wine fermentation biotech startup", "biocontrol vineyard startup", "yeast startup winemaking", "dealcoholisation technology startup"] },
  "novos-produtos": { nome: "Novos produtos e bebidas", cor: "#DB2777", icone: "wine", ordem: 5,
    descricao: "Novas bebidas e marcas: vinho sem álcool ou com pouco álcool, RTD, espirituosos, sidras e kombuchas, novos formatos e ingredientes.",
    pesquisas: ["non-alcoholic wine brand startup raises", "ready-to-drink wine startup", "low alcohol beverage startup funding", "startup bebidas sem álcool"] },
  "embalagem-sustentabilidade": { nome: "Embalagem, materiais e sustentabilidade", cor: "#E7A912", icone: "cube", ordem: 6,
    descricao: "Garrafas leves, embalagem e rótulos sustentáveis, reutilização, aproveitamento de subprodutos, carbono, energia e água.",
    pesquisas: ["sustainable wine packaging startup", "wine byproduct upcycling startup", "carbon reduction startup winery", "startup embalagem sustentável vinho"] },
  "comercio-experiencia": { nome: "Comércio digital e experiência", cor: "#EA580C", icone: "users", ordem: 7,
    descricao: "Venda direta e e-commerce, marketplaces, fintech do vinho, enoturismo, horeca e retalho, fidelização e experiências do consumidor.",
    pesquisas: ["wine e-commerce startup funding", "wine marketplace startup", "wine tourism platform startup", "wine recommendation app startup"] },
  "rastreabilidade-logistica": { nome: "Rastreabilidade e cadeia de abastecimento", cor: "#3D4170", icone: "kanban", ordem: 8,
    descricao: "Rótulos inteligentes (NFC, QR), autenticidade e anticontrafação, rastreabilidade, logística, distribuição e gestão de stock.",
    pesquisas: ["smart wine label NFC startup", "anti-counterfeiting wine bottle startup", "supply chain startup wine distribution", "startup rastreabilidade vinho"] },
};

export const CATEGORIAS_LISTA = Object.entries(CATEGORIAS_V2).map(([id, v]) => ({ id, ...v }));
