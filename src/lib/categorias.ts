/**
 * Categorias das startups (versão 3): o tipo de solução, que cruza com a cadeia de valor (os anéis do radar).
 * Cinco grupos largos que juntam as oito categorias da versão 2.
 * Guardadas na coleção «sectors» (o campo da startup continua a chamar-se «setor»).
 * Cada categoria tem as pesquisas que a recolha semanal corre (até 12).
 */
export const CATEGORIAS_VERSAO = 3;

type Cat = { nome: string; cor: string; icone: string; ordem: number; descricao: string; pesquisas: string[] };

/** As chaves são o slug do nome, para casar com as categorias criadas à mão nas Definições. */
export const CATEGORIAS_V3: Record<string, Cat> = {
  "agritech-winetech": { nome: "Agritech & Winetech", cor: "#0EA5DE", icone: "rss", ordem: 1,
    descricao: "Tecnologia para produzir e gerir o vinho, da vinha à adega e às operações. Inclui: sensores e IoT, estações meteorológicas, imagem de satélite e drones, agricultura de precisão (rega, solo, doenças, previsão de maturação e de colheita); robôs e máquinas autónomas para poda, vindima e tratamentos; automação da adega e das linhas de enchimento; biotecnologia aplicada à vinha e à adega (leveduras, fermentação, biocontrolo, bioestimulantes, proteção contra geada); software e IA de gestão de vinha e adega, ERP, controlo de qualidade, laboratório, previsão de procura, planeamento, logística e gestão de stock. Se o foco é reduzir carbono, água ou resíduos, é Sustainable Futures; se é uma bebida nova, é Product Innovation.",
    pesquisas: [
      "vineyard precision agriculture startup raises funding",
      "vineyard sensor IoT startup seed round",
      "viticulture robotics autonomous vineyard robot startup",
      "winery automation software startup",
      "AI startup winemaking quality control",
      "grape disease prediction AI startup",
      "wine fermentation yeast biotech startup",
      "biocontrol biostimulant vineyard startup funding",
      "beverage demand forecasting supply chain AI startup",
      "startup tecnologia vinha adega Portugal",
      "startup viticulture de précision levée de fonds",
      "startup agritech vigneto agricoltura di precisione",
    ] },
  "new-packaging-materials": { nome: "New packaging & materials", cor: "#7C3AED", icone: "cube", ordem: 2,
    descricao: "Novas embalagens, materiais e tudo o que vai na garrafa ou à volta dela. Inclui: garrafas leves, de papel, alumínio, PET ou outros formatos (lata, bag-in-box, keg); embalagem reutilizável e retornável, refill e sistemas de depósito; novos materiais (bioplásticos, fibras, materiais compostáveis, vidro de baixo carbono); rolhas e vedantes; rótulos e tintas sustentáveis; rótulos inteligentes (NFC, QR, RFID), embalagem conectada, autenticidade, anticontrafação e rastreabilidade do produto. Se o principal ganho da embalagem é ambiental e o produto é a embalagem, fica aqui (não em Sustainable Futures).",
    pesquisas: [
      "sustainable wine packaging startup raises",
      "paper wine bottle startup",
      "lightweight glass bottle startup innovation",
      "reusable returnable bottle system startup funding",
      "refill packaging startup beverages",
      "biomaterials packaging startup seed round",
      "smart label NFC wine bottle startup",
      "anti-counterfeiting wine authentication startup",
      "connected packaging traceability startup beverages",
      "cork closure innovation startup",
      "startup embalagem sustentável vinho",
      "startup emballage durable vin bouteille",
    ] },
  "product-innovation": { nome: "Product Innovation", cor: "#E7A912", icone: "lightbulb", ordem: 3,
    descricao: "Novos produtos, bebidas e formatos de consumo. Inclui: vinho sem álcool ou com pouco álcool e tecnologia de desalcoolização; ready-to-drink (RTD), spritzers, cocktails em lata, vinho em lata; novas categorias (hard seltzer, sidras, kombucha, bebidas funcionais e adaptogénicas, espirituosos de nova geração); novos ingredientes, sabores e aromas; processos que mudam o produto (envelhecimento acelerado, novas técnicas de vinificação, fermentação de precisão de ingredientes); marcas inovadoras apoiadas em tecnologia. Uma marca só de marketing, sem inovação no produto, não é prioritária mas fica aqui.",
    pesquisas: [
      "non-alcoholic wine startup raises funding",
      "dealcoholisation technology startup",
      "low alcohol beverage startup seed round",
      "ready-to-drink wine cocktail startup",
      "canned wine brand startup funding",
      "functional beverage startup Europe raises",
      "accelerated aging spirits technology startup",
      "precision fermentation beverage ingredients startup",
      "next generation spirits brand startup",
      "startup bebidas sem álcool Portugal",
      "startup vin sans alcool levée de fonds",
      "startup vino dealcolato innovazione",
    ] },
  "sustainable-futures": { nome: "Sustainable Futures", cor: "#16A34A", icone: "leaf", ordem: 4,
    descricao: "Soluções cujo objetivo principal é ambiental e de futuro do setor. Inclui: captura e medição de carbono, créditos de carbono, contabilidade de emissões (scope 3); agricultura regenerativa, saúde do solo e biodiversidade; gestão e reutilização de água; energia renovável e eficiência energética na adega; aproveitamento de subprodutos (bagaço, grainha, borras, engaço) em ingredientes, biomateriais ou energia; economia circular e redução de resíduos; adaptação às alterações climáticas (castas resistentes, proteção contra calor e seca). Se a solução é uma embalagem, vai para New packaging & materials.",
    pesquisas: [
      "carbon capture startup agriculture vineyard",
      "soil carbon measurement startup funding",
      "regenerative viticulture startup",
      "grape pomace upcycling startup",
      "wine byproduct valorization startup ingredients",
      "winery wastewater treatment startup",
      "scope 3 emissions tracking startup food beverage",
      "climate adaptation agriculture startup drought heat",
      "circular economy startup beverage industry raises",
      "startup economia circular subprodutos vinho",
      "startup valorisation marc de raisin",
      "startup sostenibilità vino carbonio",
    ] },
  "unforgettable-experiences": { nome: "Unforgettable experiences", cor: "#DB2777", icone: "globe", ordem: 5,
    descricao: "Tudo o que liga a marca ao consumidor e ao cliente. Inclui: e-commerce, venda direta (DTC), marketplaces e clubes de vinho; apps e IA de recomendação, sommelier virtual e personalização; fidelização, comunidade e CRM; marketing digital, social listening, consumer insights e análise de dados de venda (sell-out, POS, preços e promoções por canal); retalho e horeca (cartas digitais, dispensadores, vending, gestão de garrafeira); enoturismo, reservas, eventos e experiências imersivas (AR, VR, metaverso); educação sobre vinho; fintech e investimento em vinho. Se a ferramenta serve sobretudo a produção ou a logística, vai para Agritech & Winetech.",
    pesquisas: [
      "wine e-commerce startup raises funding",
      "wine marketplace startup Europe",
      "AI wine recommendation app startup",
      "direct-to-consumer wine club startup",
      "consumer insights AI startup beverage brands",
      "retail sell-out analytics pricing AI startup CPG",
      "loyalty personalization startup drinks brands",
      "wine tourism booking platform startup",
      "immersive experience startup hospitality",
      "on-trade restaurant wine list technology startup",
      "startup enoturismo experiência vinho Portugal",
      "startup oenotourisme expérience client vin",
    ] },
};

export const CATEGORIAS_LISTA = Object.entries(CATEGORIAS_V3).map(([id, v]) => ({ id, ...v }));
