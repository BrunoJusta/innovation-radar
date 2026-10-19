/**
 * Reconhece o país de uma startup (texto livre: português, inglês ou sigla) e devolve o código
 * numérico ISO 3166 usado no mapa (src/lib/world.json), mais um nome em português para mostrar.
 */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.()]/g, "").replace(/\s+/g, " ").trim();

/** código ISO numérico, nome em português, e outros nomes (inglês, siglas, variantes). */
const P: [string, string, string[]][] = [
  ["620", "Portugal", ["pt", "prt", "portuguesa"]],
  ["724", "Espanha", ["spain", "es", "esp", "españa", "espana"]],
  ["250", "França", ["france", "fr", "fra"]],
  ["826", "Reino Unido", ["united kingdom", "uk", "gb", "gbr", "inglaterra", "england", "escocia", "scotland", "gra-bretanha", "great britain", "britain"]],
  ["372", "Irlanda", ["ireland", "ie", "irl"]],
  ["276", "Alemanha", ["germany", "de", "deu", "deutschland"]],
  ["380", "Itália", ["italy", "it", "ita", "italia"]],
  ["528", "Países Baixos", ["netherlands", "the netherlands", "holanda", "holland", "nl", "nld", "paises baixos"]],
  ["056", "Bélgica", ["belgium", "be", "bel"]],
  ["442", "Luxemburgo", ["luxembourg", "lu"]],
  ["756", "Suíça", ["switzerland", "ch", "che", "suica"]],
  ["040", "Áustria", ["austria", "at", "aut"]],
  ["208", "Dinamarca", ["denmark", "dk", "dnk"]],
  ["752", "Suécia", ["sweden", "se", "swe", "suecia"]],
  ["578", "Noruega", ["norway", "no", "nor"]],
  ["246", "Finlândia", ["finland", "fi", "fin", "finlandia"]],
  ["352", "Islândia", ["iceland", "is", "islandia"]],
  ["233", "Estónia", ["estonia", "ee", "est", "estônia"]],
  ["428", "Letónia", ["latvia", "lv", "letonia"]],
  ["440", "Lituânia", ["lithuania", "lt", "lituania"]],
  ["616", "Polónia", ["poland", "pl", "pol", "polonia", "polônia"]],
  ["203", "Chéquia", ["czechia", "czech republic", "cz", "republica checa", "chequia"]],
  ["703", "Eslováquia", ["slovakia", "sk", "eslovaquia"]],
  ["348", "Hungria", ["hungary", "hu"]],
  ["642", "Roménia", ["romania", "ro", "romenia"]],
  ["100", "Bulgária", ["bulgaria", "bg"]],
  ["300", "Grécia", ["greece", "gr", "grecia"]],
  ["705", "Eslovénia", ["slovenia", "si", "eslovenia"]],
  ["191", "Croácia", ["croatia", "hr", "croacia"]],
  ["688", "Sérvia", ["serbia", "rs", "servia"]],
  ["792", "Turquia", ["turkey", "turkiye", "tr"]],
  ["804", "Ucrânia", ["ukraine", "ua", "ucrania"]],
  ["196", "Chipre", ["cyprus", "cy"]],
  ["376", "Israel", ["il", "isr"]],
  ["784", "Emirados Árabes Unidos", ["united arab emirates", "uae", "eau", "emirados", "dubai"]],
  ["682", "Arábia Saudita", ["saudi arabia", "arabia saudita", "ksa"]],
  ["840", "Estados Unidos", ["united states of america", "united states", "usa", "us", "eua", "eu a", "america", "estados unidos da america"]],
  ["124", "Canadá", ["canada", "ca", "can"]],
  ["484", "México", ["mexico", "mx", "mex"]],
  ["076", "Brasil", ["brazil", "br", "bra"]],
  ["032", "Argentina", ["ar", "arg"]],
  ["152", "Chile", ["cl", "chl"]],
  ["858", "Uruguai", ["uruguay", "uy"]],
  ["170", "Colômbia", ["colombia", "co"]],
  ["604", "Peru", ["pe"]],
  ["710", "África do Sul", ["south africa", "za", "africa do sul"]],
  ["504", "Marrocos", ["morocco", "ma"]],
  ["818", "Egito", ["egypt", "eg", "egipto"]],
  ["404", "Quénia", ["kenya", "ke", "quenia"]],
  ["566", "Nigéria", ["nigeria", "ng"]],
  ["024", "Angola", ["ao"]],
  ["508", "Moçambique", ["mozambique", "mz", "mocambique"]],
  ["356", "Índia", ["india", "in", "ind"]],
  ["156", "China", ["cn", "chn"]],
  ["392", "Japão", ["japan", "jp", "jpn", "japao"]],
  ["410", "Coreia do Sul", ["south korea", "korea", "kr", "coreia"]],
  ["158", "Taiwan", ["tw"]],
  ["764", "Tailândia", ["thailand", "th", "tailandia"]],
  ["704", "Vietname", ["vietnam", "viet nam", "vn", "vietna"]],
  ["458", "Malásia", ["malaysia", "my", "malasia"]],
  ["360", "Indonésia", ["indonesia", "id"]],
  ["608", "Filipinas", ["philippines", "ph"]],
  ["036", "Austrália", ["australia", "au", "aus"]],
  ["554", "Nova Zelândia", ["new zealand", "nz", "nova zelandia"]],
  ["643", "Rússia", ["russia", "ru", "russia federation", "russian federation"]],
];
// Países e cidades demasiado pequenos para o mapa (contam na tabela, mas não têm forma desenhada)
const SEM_MAPA: [string, string[]][] = [
  ["Singapura", ["singapore", "sg", "sgp"]], ["Hong Kong", ["hk"]], ["Malta", ["mt"]], ["Mónaco", ["monaco", "mc"]], ["Andorra", ["ad"]],
];

const IDX = new Map<string, { id: string | null; nome: string }>();
for (const [id, nome, alt] of P) [nome, ...alt].forEach((n) => IDX.set(fold(n), { id, nome }));
for (const [nome, alt] of SEM_MAPA) [nome, ...alt].forEach((n) => IDX.set(fold(n), { id: null, nome }));

/** País reconhecido: `id` é o código do mapa (null se não tiver forma no mapa). Sem país ou desconhecido devolve null. */
export function lerPais(txt: string | undefined | null): { id: string | null; nome: string } | null {
  if (!txt || !txt.trim()) return null;
  // "Lisboa, Portugal" ou "Portugal / Espanha": usa o primeiro pedaço que for um país
  const partes = [txt, ...txt.split(/[,/;|]| e | and /)];
  for (const p of partes) { const r = IDX.get(fold(p)); if (r) return r; }
  return null;
}
