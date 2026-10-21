/**
 * Prepara a base de dados: cadeias de valor, tags, fontes, definições e o primeiro administrador.
 * Não cria notícias. Pode correr-se várias vezes: só cria o que ainda não existe.
 */
import { adminDb } from "./lib/admin";
import { AREAS_V2, TAGS_V2 } from "../src/lib/taxonomia";

const ADMIN = (process.env.SEED_ADMIN || "bruno.justa@sogrape.pt").toLowerCase();

import { CATEGORIAS_V3 } from "../src/lib/categorias";
import { ETAPA_ANTIGA } from "../src/lib/types";
const DATA: Record<string, Record<string, object>> = {
  // Taxonomia v2: cadeias de valor (anéis) e tags (temáticas, tecnologias e canais)
  areas: AREAS_V2,
  categories: TAGS_V2,
  sources: {
    // Notícias (recolha diária). Testadas em outubro de 2026.
    "grande-consumo": { nome: "Grande Consumo", tipo: "rss", url: "https://grandeconsumo.com/feed/", lingua: "pt", ativo: true, grupo: "Tendências de consumo e inovação de produto" },
    "beveragedaily": { nome: "BeverageDaily", tipo: "rss", url: "https://www.beveragedaily.com/arc/outboundfeeds/rss/", lingua: "en", ativo: true, grupo: "Vinhos, espirituosos e bebidas" },
    "the-drinks-business": { nome: "The Drinks Business", tipo: "wp-api", url: "https://www.thedrinksbusiness.com", lingua: "en", ativo: true, grupo: "Vinhos, espirituosos e bebidas" },
    "iwsr": { nome: "IWSR", tipo: "rss", url: "https://www.theiwsr.com/feed/", lingua: "en", ativo: true, grupo: "Vinhos, espirituosos e bebidas" },
    "foodbev": { nome: "FoodBev", tipo: "rss", url: "https://www.foodbev.com/blog-feed.xml", lingua: "en", ativo: true, grupo: "Vinhos, espirituosos e bebidas" },
    "just-drinks-vinhos": { nome: "Just Drinks · Vinhos", tipo: "rss", url: "https://www.just-drinks.com/sector/alcoholic-beverages/wines/feed/", lingua: "en", ativo: true, grupo: "Vinhos, espirituosos e bebidas" },
    "just-drinks-espirituosos": { nome: "Just Drinks · Espirituosos", tipo: "rss", url: "https://www.just-drinks.com/sector/alcoholic-beverages/spirits/feed/", lingua: "en", ativo: true, grupo: "Vinhos, espirituosos e bebidas" },
    "circana": { nome: "Circana", tipo: "rss", url: "https://www.circana.com/blog-feed.xml", lingua: "en", ativo: true, grupo: "Tendências de consumo e inovação de produto" },
    "packaging-europe": { nome: "Packaging Europe", tipo: "rss", url: "https://www.packagingeurope.com/latest/rss/", lingua: "en", ativo: true, grupo: "Embalagem, materiais e sustentabilidade" },
    "sustainable-packaging-news": { nome: "Sustainable Packaging News", tipo: "rss", url: "https://spnews.com/api/rss/content.rss", lingua: "en", ativo: true, grupo: "Embalagem, materiais e sustentabilidade" },
    "dezeen-packaging": { nome: "Dezeen · Packaging", tipo: "rss", url: "https://www.dezeen.com/tag/packaging/feed/", lingua: "en", ativo: true, grupo: "Embalagem, materiais e sustentabilidade" },
    "skift": { nome: "Skift", tipo: "rss", url: "https://skift.com/feed/", lingua: "en", ativo: true, grupo: "Experiência do consumidor, hotelaria e retalho" },
    "hospitality-net-europa": { nome: "Hospitality Net · Europa", tipo: "rss", url: "https://www.hospitalitynet.org/rss/news/europe.xml", lingua: "en", ativo: true, grupo: "Experiência do consumidor, hotelaria e retalho" },
    "trendwatching": { nome: "TrendWatching", tipo: "rss", url: "https://www.trendwatching.com/trends-and-insights/rss.xml", lingua: "en", ativo: true, grupo: "Experiência do consumidor, hotelaria e retalho" },
    "retail-touchpoints": { nome: "Retail TouchPoints", tipo: "rss", url: "https://www.retailtouchpoints.com/feed", lingua: "en", ativo: true, grupo: "Experiência do consumidor, hotelaria e retalho" },
    "the-future-laboratory": { nome: "The Future Laboratory", tipo: "rss", url: "https://www.thefuturelaboratory.com/blog/rss.xml", lingua: "en", ativo: true, grupo: "Experiência do consumidor, hotelaria e retalho" },
    // Startups (recolha semanal): artigos da semana → startups citadas → ficha
    "agfundernews": { nome: "AgFunderNews", tipo: "wp-api", url: "https://agfundernews.com/wp-json/wp/v2/posts?categories=772,773,1471,1479", lingua: "en", ativo: true, para: "startups" },
    "crunchbase-news-agrifood": { nome: "Crunchbase News · Agrifood", tipo: "wp-api", url: "https://news.crunchbase.com/wp-json/wp/v2/posts?categories=2046", lingua: "en", ativo: true, para: "startups" },
    "the-spoon": { nome: "The Spoon", tipo: "rss", url: "https://thespoon.tech/feed/", lingua: "en", ativo: true, para: "startups" },
  },
  settings: { geral: { corteRelevancia: 50, janelaDias: 90, corteStartups: 50 } },
  users: { [ADMIN]: { role: "admin", nome: "Bruno Justa", adicionadoEm: new Date().toISOString(), adicionadoPor: "seed" } },
};

/**
 * Setores antigos, substituídos pelas categorias (tipo de solução). As startups que os usavam ficam sem categoria válida
 * e são reclassificadas pela Gemini na recolha semanal ou no botão das Definições.
 */
const OLD_SECTORS = ["wine-tech", "viticultura-agtech", "ia-aplicada", "no-low-bebidas", "vinha-adega", "embalagem-rotulos", "consumidor-vendas", "dados-operacoes"];

async function main() {
  const db = adminDb();
  for (const old of OLD_SECTORS) {
    const ref = db.collection("sectors").doc(old);
    if (!(await ref.get()).exists) continue;
    await ref.delete();
    console.log(`setor antigo ${old} removido (as startups dele são reclassificadas na recolha semanal)`);
  }
  // Categorias das startups: só se a coleção estiver vazia (as categorias são geridas nas Definições)
  if ((await db.collection("sectors").limit(1).get()).empty) {
    for (const [id, c] of Object.entries(CATEGORIAS_V3)) { await db.collection("sectors").doc(id).set(c); console.log(`criado   sectors/${id}`); }
  }
  for (const [col, docs] of Object.entries(DATA)) for (const [id, data] of Object.entries(docs)) {
    try { await db.collection(col).doc(id).create(data); console.log(`criado   ${col}/${id}`); }
    catch (e) {
      if ((e as { code?: number }).code !== 6) throw e;
      console.log(`já existe ${col}/${id}`);
      // Fontes antigas sem grupo ficam com o grupo sugerido (não mexe no resto)
      const grupo = (data as { grupo?: string }).grupo;
      if (col === "sources" && grupo) {
        const ref = db.collection(col).doc(id);
        if (!(await ref.get()).data()?.grupo) { await ref.update({ grupo }); console.log(`  grupo  ${grupo}`); }
      }
    }
  }
  // Pipeline: fases da versão anterior → fases atuais (contacto → Validation Fit, análise Beta Capital → General Analysis, negociação → Closing Stage)
  const deals = await db.collection("deals").get();
  let mudadas = 0;
  for (const d of deals.docs) {
    const x = d.data() as { etapa?: string; arquivo?: { etapaAnterior?: string | null } | null };
    const upd: Record<string, unknown> = {};
    if (x.etapa && ETAPA_ANTIGA[x.etapa]) upd.etapa = ETAPA_ANTIGA[x.etapa];
    const ant = x.arquivo?.etapaAnterior;
    if (ant && ETAPA_ANTIGA[ant]) upd["arquivo.etapaAnterior"] = ETAPA_ANTIGA[ant];
    if (Object.keys(upd).length) { await d.ref.update(upd); mudadas++; }
  }
  console.log(`Pipeline: ${mudadas} fichas passaram para as fases novas.`);
  console.log("Seed concluído. Nenhuma notícia foi criada.");
}
main().catch((e) => { console.error(e); process.exit(1); });
