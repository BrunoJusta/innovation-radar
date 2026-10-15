/**
 * Prepara a base de dados: áreas, categorias, fontes, definições e o primeiro administrador.
 * Não cria notícias. Pode correr-se várias vezes: só cria o que ainda não existe.
 */
import { adminDb } from "./lib/admin";

const ADMIN = (process.env.SEED_ADMIN || "bruno.justa@sogrape.pt").toLowerCase();

const DATA: Record<string, Record<string, object>> = {
  areas: {
    "consumo-mercado": { nome: "Consumo e mercado", cor: "#7C3AED", ordem: 1,
      descricao: "Comportamento do consumidor, tendências de consumo, lançamentos de produtos e marcas, retalho, distribuição, preços, dados de mercado e regulação." },
    tecnologia: { nome: "Tecnologia", cor: "#0EA5DE", ordem: 2,
      descricao: "Ferramentas e tecnologias: IA, dados, automação, processos de produção (incluindo desalcoolização), embalagem, digital e startups tecnológicas." },
  },
  categories: {
    "no-alcohol": { nome: "No Alcohol", icone: "wine", ordem: 1,
      descricao: "Vinhos e bebidas sem álcool ou com baixo teor alcoólico (no/low), desalcoolização, moderação e alternativas ao álcool.",
      palavrasChave: ["sem álcool", "0,0", "0.0", "zero álcool", "baixo teor alcoólico", "baixo álcool", "desalcoolizado", "desalcoolizada", "desalcoolização", "moderação", "bebidas funcionais",
        "non-alcoholic", "nonalcoholic", "alcohol-free", "alcohol free", "no-alcohol", "no alcohol", "low-alcohol", "low alcohol", "no and low", "no/low", "nolo", "no-lo",
        "dealcoholised", "dealcoholized", "de-alcoholised", "de-alcoholized", "dealcoholisation", "dealcoholization", "zero-proof", "zero proof", "mocktail", "mocktails", "sober curious", "moderation", "functional drinks"] },
    ia: { nome: "IA", icone: "sparkle", ordem: 2,
      descricao: "Inteligência artificial aplicada a bebidas, vinho, retalho e consumo: IA generativa, machine learning, automação inteligente, agentes e visão computacional.",
      palavrasChave: ["inteligência artificial", "ia", "ia generativa", "aprendizagem automática", "algoritmo", "algoritmos", "automação", "visão computacional", "agente de ia", "agentes de ia", "chatbot",
        "artificial intelligence", "ai", "ai-powered", "ai-driven", "generative ai", "genai", "machine learning", "deep learning", "llm", "chatgpt", "openai", "gemini", "copilot",
        "computer vision", "predictive analytics", "ai agent", "ai agents", "agentic", "automation", "algorithm"] },
  },
  sources: {
    "grande-consumo": { nome: "Grande Consumo", tipo: "rss", url: "https://grandeconsumo.com/feed/", lingua: "pt", ativo: true },
    beveragedaily: { nome: "BeverageDaily", tipo: "rss", url: "https://www.beveragedaily.com/arc/outboundfeeds/rss/", lingua: "en", ativo: true },
  },
  settings: { geral: { corteRelevancia: 50, janelaDias: 90, corteStartups: 50 } },
  sectors: {
    "wine-tech": { nome: "Wine Tech", cor: "#7C3AED", icone: "wine", ordem: 1,
      descricao: "Software e hardware para adegas e para o negócio do vinho: produção, rastreabilidade, vendas, distribuição, enoturismo e experiência do consumidor.",
      pesquisas: ["wine tech startup raises funding", "winetech startup seed round", "startup tecnologia vinho Portugal", "wine industry software startup launch"] },
    "viticultura-agtech": { nome: "Viticultura e AgTech", cor: "#16A34A", icone: "leaf", ordem: 2,
      descricao: "Viticultura de precisão e agricultura: sensores, drones, robótica, imagem de satélite, gestão de água, solo, clima e doenças da vinha.",
      pesquisas: ["vineyard precision agriculture startup", "viticulture robotics startup funding", "startup agricultura de precisão vinha", "vineyard disease detection AI startup"] },
    "ia-aplicada": { nome: "IA aplicada", cor: "#0EA5DE", icone: "sparkle", ordem: 3,
      descricao: "Inteligência artificial aplicada a bebidas, vinho, retalho e consumo: previsão de procura, qualidade, marketing, recomendação, operações e agentes.",
      pesquisas: ["AI startup beverage industry", "AI wine recommendation startup", "generative AI startup food and beverage brands", "AI demand forecasting startup drinks"] },
    "no-low-bebidas": { nome: "No/Low e bebidas", cor: "#E7A912", icone: "flask", ordem: 4,
      descricao: "Bebidas sem álcool ou com baixo teor, tecnologia de desalcoolização, novas categorias de bebidas, embalagem e sustentabilidade.",
      pesquisas: ["non-alcoholic wine startup funding", "dealcoholisation technology startup", "alcohol-free drinks startup raises", "sustainable wine packaging startup"] },
  },
  users: { [ADMIN]: { role: "admin", nome: "Bruno Justa", adicionadoEm: new Date().toISOString(), adicionadoPor: "seed" } },
};

async function main() {
  const db = adminDb();
  for (const [col, docs] of Object.entries(DATA)) for (const [id, data] of Object.entries(docs)) {
    try { await db.collection(col).doc(id).create(data); console.log(`criado   ${col}/${id}`); }
    catch (e) { if ((e as { code?: number }).code === 6) console.log(`já existe ${col}/${id}`); else throw e; }
  }
  console.log("Seed concluído. Nenhuma notícia foi criada.");
}
main().catch((e) => { console.error(e); process.exit(1); });
