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
    "vinha-adega": { nome: "Vinha e adega", cor: "#16A34A", icone: "leaf", ordem: 1,
      descricao: "Tecnologia para a vinha e para a adega: viticultura de precisão, sensores, drones, robótica, clima, água, solo, doenças, controlo de fermentação, qualidade e desalcoolização.",
      pesquisas: ["vineyard precision agriculture startup", "viticulture robotics startup funding", "startup controlo de fermentação vinho", "dealcoholisation technology startup"] },
    "embalagem-rotulos": { nome: "Embalagem e rótulos", cor: "#E7A912", icone: "cube", ordem: 2,
      descricao: "Rótulos inteligentes (NFC, QR, realidade aumentada), anticontrafação, rastreabilidade da garrafa, garrafas leves, embalagem sustentável e novos formatos.",
      pesquisas: ["smart wine label NFC startup", "startups de rótulos inteligentes para vinhos", "anti-counterfeiting wine bottle startup", "sustainable wine packaging startup"] },
    "consumidor-vendas": { nome: "Consumidor e vendas", cor: "#7C3AED", icone: "users", ordem: 3,
      descricao: "Venda e relação com o consumidor: e-commerce e venda direta, marketplaces, recomendação personalizada, enoturismo, fidelização, marcas no/low e experiências digitais.",
      pesquisas: ["wine e-commerce startup funding", "wine recommendation app startup", "wine tourism platform startup", "non-alcoholic wine brand startup raises"] },
    "dados-operacoes": { nome: "Dados e operações", cor: "#0EA5DE", icone: "chart-line", ordem: 4,
      descricao: "Dados e IA para a operação: previsão de procura, planeamento, cadeia de abastecimento, logística, preços, gestão de stock e automação.",
      pesquisas: ["AI demand forecasting startup beverage", "supply chain startup wine distribution", "pricing analytics startup drinks", "AI startup food and beverage operations"] },
  },
  users: { [ADMIN]: { role: "admin", nome: "Bruno Justa", adicionadoEm: new Date().toISOString(), adicionadoPor: "seed" } },
};

/** Setores da primeira versão, substituídos pelos atuais. As startups que os usavam passam para o setor mais próximo. */
const OLD_SECTORS: Record<string, string> = {
  "wine-tech": "consumidor-vendas", "viticultura-agtech": "vinha-adega", "ia-aplicada": "dados-operacoes", "no-low-bebidas": "vinha-adega",
};

async function main() {
  const db = adminDb();
  for (const [old, novo] of Object.entries(OLD_SECTORS)) {
    const ref = db.collection("sectors").doc(old);
    if (!(await ref.get()).exists) continue;
    const st = await db.collection("startups").where("setor", "==", old).get();
    for (const d of st.docs) await d.ref.update({ setor: novo });
    await ref.delete();
    console.log(`setor antigo ${old} removido (${st.size} startups passaram para ${novo})`);
  }
  for (const [col, docs] of Object.entries(DATA)) for (const [id, data] of Object.entries(docs)) {
    try { await db.collection(col).doc(id).create(data); console.log(`criado   ${col}/${id}`); }
    catch (e) { if ((e as { code?: number }).code === 6) console.log(`já existe ${col}/${id}`); else throw e; }
  }
  console.log("Seed concluído. Nenhuma notícia foi criada.");
}
main().catch((e) => { console.error(e); process.exit(1); });
