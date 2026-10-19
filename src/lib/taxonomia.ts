/**
 * Taxonomia do Radar Trends (versão 2): cadeias de valor (os anéis) e tags em três tipos.
 * Uma notícia tem uma cadeia de valor e várias tags: pelo menos uma temática, e tecnologias e canais quando fizer sentido.
 * Usada pelo seed, pela migração na recolha diária e como referência no backoffice.
 */
import type { TipoTag } from "./types";

export const TAXONOMIA_VERSAO = 2;

type AreaSeed = { nome: string; cor: string; ordem: number; descricao: string };
type TagSeed = { nome: string; tipo: TipoTag; icone: string; ordem: number; descricao: string; palavrasChave: string[] };

/** Cadeias de valor, do centro do radar para fora. */
export const AREAS_V2: Record<string, AreaSeed> = {
  viticultura: { nome: "Viticultura", cor: "#4F7A3A", ordem: 1,
    descricao: "Vinha e uva: plantação, castas, clima na vinha, solo, rega, pragas e doenças, vindima e trabalho no campo." },
  enologia: { nome: "Enologia", cor: "#7A2338", ordem: 2,
    descricao: "Fazer o vinho: fermentação, leveduras, estágio, lotes, desalcoolização, análises e qualidade do vinho." },
  producao: { nome: "Produção", cor: "#B15533", ordem: 3,
    descricao: "Adega e fábrica: engarrafamento, linhas de enchimento, embalagem na linha, energia, água, manutenção e operações industriais." },
  marketing: { nome: "Marketing", cor: "#B07A12", ordem: 4,
    descricao: "Marcas e comunicação: posicionamento, lançamentos de marca, campanhas, rótulos e design, patrocínios e social media." },
  "vendas-distribuicao": { nome: "Vendas e distribuição", cor: "#2F6B73", ordem: 5,
    descricao: "Levar o produto ao mercado: distribuidores, importadores, retalho, restauração, preços, exportação, logística comercial e canais de venda." },
  consumidor: { nome: "Consumidor", cor: "#9B4D6B", ordem: 6,
    descricao: "Quem bebe: comportamentos, tendências e ocasiões de consumo, gerações, saúde e moderação, estudos e dados de consumo." },
  adjacencias: { nome: "Adjacências", cor: "#5E6B7A", ordem: 7,
    descricao: "O que está à volta do vinho: outras bebidas (cerveja, espirituosos, RTD, sem álcool), hotelaria, turismo, alimentação, regulação e economia." },
};

const k = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Tags: temáticas, tecnologias e canais. */
export const TAGS_V2: Record<string, TagSeed> = {
  // 02 Temática
  "inovacao-produto": { nome: "Inovação de produto", tipo: "tematica", icone: "lightbulb", ordem: 1,
    descricao: "Novas bebidas, novos produtos e formatos, no/low alcohol, novos estilos de vinho e extensões de gama.",
    palavrasChave: k("novo produto, novos produtos, lançamento, lança, lançou, nova bebida, novas bebidas, sem álcool, baixo teor alcoólico, desalcoolizado, desalcoolização, 0.0, rtd, pronto a beber, vinho em lata, new product, new products, launch, launches, launched, unveils, debuts, new drink, product innovation, non-alcoholic, alcohol-free, low-alcohol, no and low, no/low, nolo, dealcoholised, dealcoholized, zero-proof, ready-to-drink, canned wine, line extension, new range") },
  "experiencias-consumo": { nome: "Experiências e ocasiões de consumo", tipo: "tematica", icone: "users", ordem: 2,
    descricao: "Novas ocasiões e novas experiências de consumo: como, quando e onde se bebe, eventos, provas e experiências de marca.",
    palavrasChave: k("ocasião de consumo, ocasiões de consumo, experiência, experiências, prova de vinhos, provas, evento, eventos, festival, consumption occasion, consumption occasions, drinking occasions, occasion, experience, experiences, experiential, tasting, tastings, event, events, festival, pop-up, immersive, at-home, gen z, millennials, sober curious, moderation") },
  "embalagem-materiais": { nome: "Embalagem e materiais", tipo: "tematica", icone: "cube", ordem: 3,
    descricao: "Novos formatos de embalagem, smart packaging e novos materiais: garrafas, rolhas, rótulos, latas, bag-in-box, reutilização.",
    palavrasChave: k("embalagem, embalagens, garrafa, garrafas, vidro, rolha, rolhas, cortiça, rótulo, rótulos, lata, latas, bag-in-box, garrafa leve, reutilizável, packaging, bottle, bottles, glass, lightweight bottle, closure, closures, cork, screwcap, label, labels, cans, canned, aluminium, aluminum, paper bottle, pouch, refillable, reusable, smart packaging, recyclable, materials") },
  sustentabilidade: { nome: "Sustentabilidade", tipo: "tematica", icone: "globe", ordem: 4,
    descricao: "Clima, biodiversidade, economia circular, ESG, emissões, energia e água, certificações ambientais.",
    palavrasChave: k("sustentabilidade, sustentável, clima, alterações climáticas, biodiversidade, economia circular, carbono, emissões, pegada, esg, renovável, sustainability, sustainable, climate, climate change, biodiversity, circular economy, carbon, net zero, net-zero, emissions, footprint, esg, renewable, b corp, regenerative, decarbonisation, decarbonization") },
  agricultura: { nome: "Agricultura", tipo: "tematica", icone: "leaf", ordem: 5,
    descricao: "Viticultura de precisão, agricultura regenerativa, pesticidas, gestão hídrica, novas castas e genética.",
    palavrasChave: k("vinha, vinhas, viticultura, viticultor, castas, casta, uva, uvas, vindima, rega, seca, pesticidas, fitossanitários, agricultura regenerativa, genética, vineyard, vineyards, viticulture, grape, grapes, grapevine, harvest, irrigation, drought, pesticide, pesticides, regenerative agriculture, precision viticulture, grape variety, varieties, genetics, disease-resistant, piwi, mildew") },
  logistica: { nome: "Logística", tipo: "tematica", icone: "kanban", ordem: 6,
    descricao: "Armazenamento e stocks, rotas e eficiência de distribuição, transporte, cadeia de abastecimento e last mile.",
    palavrasChave: k("logística, armazém, armazenamento, stock, stocks, transporte, distribuição, cadeia de abastecimento, entregas, last mile, logistics, warehouse, warehousing, inventory, stock levels, shipping, freight, transport, supply chain, distribution, delivery, deliveries, last-mile, last mile, tariffs, tariff") },
  "marketing-tema": { nome: "Marketing", tipo: "tematica", icone: "target", ordem: 7,
    descricao: "Posicionamento de marca, premiumização, social media, campanhas e parcerias, celebrity marketing e personalização.",
    palavrasChave: k("marketing, marca, marcas, campanha, campanhas, publicidade, parceria, parcerias, patrocínio, premiumização, redes sociais, influenciador, influencers, brand, brands, branding, campaign, campaigns, advertising, partnership, partnerships, sponsorship, premiumisation, premiumization, social media, influencer, celebrity, rebrand, personalisation, personalization, loyalty") },

  // 03 Tecnologia
  ia: { nome: "Inteligência artificial", tipo: "tecnologia", icone: "sparkle", ordem: 1,
    descricao: "IA generativa, machine learning, agentes, visão computacional e automação inteligente aplicadas ao setor.",
    palavrasChave: k("inteligência artificial, ia generativa, aprendizagem automática, visão computacional, agente de ia, agentes de ia, chatbot, artificial intelligence, ai, ai-powered, ai-driven, generative ai, genai, machine learning, deep learning, llm, chatgpt, openai, gemini, copilot, computer vision, ai agent, ai agents, agentic") },
  "dados-analytics": { nome: "Dados e analytics", tipo: "tecnologia", icone: "chart-line", ordem: 2,
    descricao: "Dados, análise preditiva, previsão de procura, dashboards, CRM e dados de consumidor e de mercado.",
    palavrasChave: k("dados, análise de dados, analítica, previsão, previsão de procura, big data, analytics, predictive, predictive analytics, forecasting, demand forecasting, dashboard, insights platform, crm, first-party data, data-driven, data platform") },
  "robotica-automacao": { nome: "Robótica e automação", tipo: "tecnologia", icone: "gear", ordem: 3,
    descricao: "Robôs, automação de linhas e processos, máquinas autónomas na vinha e na adega.",
    palavrasChave: k("robô, robôs, robótica, automação, automatizado, autónomo, drone, drones, robot, robots, robotic, robotics, automation, automated, autonomous, cobot, drone, drones, self-driving tractor") },
  "iot-sensores": { nome: "IoT e sensores", tipo: "tecnologia", icone: "rss", ordem: 4,
    descricao: "Sensores, dispositivos ligados, monitorização em tempo real na vinha, na adega e na cadeia.",
    palavrasChave: k("sensor, sensores, iot, internet das coisas, monitorização, telemetria, sensors, internet of things, connected device, connected devices, monitoring, real-time monitoring, telemetry, smart sensor") },
  rastreabilidade: { nome: "Rastreabilidade e autenticidade", tipo: "tecnologia", icone: "check-circle", ordem: 5,
    descricao: "Rastreio da origem, anticontrafação, blockchain, NFC e QR, passaporte digital do produto.",
    palavrasChave: k("rastreabilidade, rastreio, autenticidade, contrafação, falsificação, blockchain, nfc, código qr, qr code, passaporte digital, traceability, tracking, provenance, authenticity, counterfeit, counterfeiting, fraud, anti-counterfeit, rfid, digital product passport, serialisation, serialization") },
  agritech: { nome: "Agritech", tipo: "tecnologia", icone: "flask", ordem: 6,
    descricao: "Tecnologia agrícola: biotecnologia, bioestimulantes, imagem por satélite, agricultura de precisão.",
    palavrasChave: k("agritech, agtech, agrotech, biotecnologia, bioestimulante, bioestimulantes, satélite, agricultura de precisão, biotech, biotechnology, biostimulant, biostimulants, satellite imagery, precision agriculture, precision farming, crop protection, gene editing, crispr") },
  winetech: { nome: "Winetech", tipo: "tecnologia", icone: "wine", ordem: 7,
    descricao: "Tecnologia específica do vinho: startups de vinho, apps de recomendação, plataformas de venda, tecnologia de adega.",
    palavrasChave: k("winetech, wine tech, wine technology, wine app, wine startup, wine platform, vivino, tecnologia do vinho, app de vinhos, plataforma de vinhos, startup de vinho") },

  // 04 Canal
  "on-trade": { nome: "On-trade", tipo: "canal", icone: "users", ordem: 1,
    descricao: "Consumo fora de casa: restaurantes, bares, hotéis, horeca.",
    palavrasChave: k("restauração, restaurante, restaurantes, bar, bares, horeca, carta de vinhos, on-trade, on premise, on-premise, restaurant, restaurants, bars, hospitality, wine list, sommelier, sommeliers") },
  "off-trade": { nome: "Off-trade", tipo: "canal", icone: "tray", ordem: 2,
    descricao: "Venda para casa: supermercados, hipermercados, garrafeiras e retalho físico.",
    palavrasChave: k("supermercado, supermercados, hipermercado, garrafeira, garrafeiras, retalho, grande distribuição, marca própria, off-trade, off premise, off-premise, supermarket, supermarkets, grocery, retailer, retailers, retail, liquor store, private label, own label") },
  "e-commerce": { nome: "E-commerce", tipo: "canal", icone: "device-mobile", ordem: 3,
    descricao: "Vendas online, marketplaces, direct-to-consumer, subscrições, quick commerce.",
    palavrasChave: k("comércio eletrónico, loja online, vendas online, venda online, e-commerce, ecommerce, marketplace, direct-to-consumer, dtc, d2c, subscription, subscriptions, quick commerce, q-commerce, amazon, online sales, webshop") },
  "travel-retail": { nome: "Travel retail", tipo: "canal", icone: "globe", ordem: 4,
    descricao: "Lojas de aeroporto, duty free, cruzeiros e viagens.",
    palavrasChave: k("travel retail, duty free, duty-free, aeroporto, aeroportos, airport, airports, gtr, global travel retail, cruise, airline") },
  enoturismo: { nome: "Enoturismo", tipo: "canal", icone: "wine", ordem: 5,
    descricao: "Visitas a quintas e adegas, provas na origem, alojamento e experiências de enoturismo.",
    palavrasChave: k("enoturismo, quinta, quintas, visita à adega, visitas, wine tourism, enotourism, oenotourism, cellar door, winery visit, winery visits, tasting room, wine route") },
  b2b: { nome: "B2B", tipo: "canal", icone: "briefcase", ordem: 6,
    descricao: "Negócio entre empresas: fornecedores, distribuidores, importadores, private label, granel, feiras profissionais.",
    palavrasChave: k("b2b, fornecedor, fornecedores, importador, importadores, distribuidor, distribuidores, granel, feira, feiras, supplier, suppliers, importer, importers, distributor, distributors, wholesale, wholesaler, bulk wine, trade fair, trade show, prowein, vinexpo, wine paris") },
};

/** As cadeias de valor como lista (para quando a coleção «areas» ainda não carregou). */
export const AREAS_LISTA = Object.entries(AREAS_V2).map(([id, v]) => ({ id, ...v }));

/** Paleta terrosa da Sogrape para as cadeias de valor (a ferrugem #B15533 é a cor da marca). */
export const PALETA_CADEIAS: Record<string, string> = {
  viticultura: "#4F7A3A", enologia: "#7A2338", producao: "#B15533", marketing: "#B07A12",
  "vendas-distribuicao": "#2F6B73", consumidor: "#9B4D6B", adjacencias: "#5E6B7A",
};
