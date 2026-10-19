/**
 * Prepara documentos para a análise de investimento: o texto dos Word, PowerPoint, Excel e ficheiros de texto
 * é lido no browser; os PDF e as imagens seguem tal como estão (a Gemini lê-os diretamente).
 */
import { abrirZip, lerFolha } from "./xlsx-lite";

export type DocAnalise = { nome: string; mime: string; texto?: string; base64?: string };

/** Limites: o pedido à Vercel tem de ficar abaixo de 4,5 MB. */
export const MAX_BINARIO = 3_000_000; // bytes de PDF e imagens no total
const MAX_TEXTO = 60_000; // caracteres por documento

const DIRETOS: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
export const ACEITES = ".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp";

const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
const textoXml = (x: string, tag: string, quebra: string) => {
  const d = new DOMParser().parseFromString(x, "application/xml");
  return Array.from(d.getElementsByTagNameNS("*", quebra)).map((p) => Array.from(p.getElementsByTagNameNS("*", tag)).map((t) => t.textContent || "").join("")).filter((t) => t.trim()).join("\n");
};
const b64 = (buf: ArrayBuffer) => { let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

export async function lerDocumento(f: File): Promise<DocAnalise> {
  const e = ext(f.name);
  if (DIRETOS[e]) return { nome: f.name, mime: DIRETOS[e], base64: b64(await f.arrayBuffer()) };
  let texto = "";
  if (e === "docx") {
    const z = abrirZip(await f.arrayBuffer());
    texto = textoXml(await z.ler("word/document.xml"), "t", "p");
  } else if (e === "pptx") {
    const z = abrirZip(await f.arrayBuffer());
    const slides = z.nomes.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    texto = (await Promise.all(slides.map(async (n, i) => `--- Diapositivo ${i + 1} ---\n${textoXml(await z.ler(n), "t", "p")}`))).join("\n");
  } else if (e === "xlsx") {
    const buf = await f.arrayBuffer();
    const z = abrirZip(buf);
    const wb = new DOMParser().parseFromString(await z.ler("xl/workbook.xml"), "application/xml");
    const folhas = Array.from(wb.getElementsByTagNameNS("*", "sheet")).map((s) => s.getAttribute("name") || "").filter(Boolean).slice(0, 6);
    for (const nome of folhas) {
      const linhas = await lerFolha(buf, nome);
      texto += `--- Folha ${nome} ---\n${linhas.filter((r) => r.some((c) => c !== null && c !== "")).slice(0, 400).map((r) => r.map((c) => c ?? "").join(" | ")).join("\n")}\n`;
    }
  } else if (["txt", "md", "csv", "json"].includes(e)) {
    texto = await f.text();
  } else throw new Error(`«${f.name}»: formato não suportado. Usa PDF, Word, PowerPoint, Excel, texto ou imagem.`);
  if (!texto.trim()) throw new Error(`«${f.name}» não tem texto que se possa ler.`);
  return { nome: f.name, mime: "text/plain", texto: texto.slice(0, MAX_TEXTO) };
}

/** Bytes que os documentos ocupam no pedido. */
export const pesoDocs = (d: DocAnalise[]) => d.reduce((n, x) => n + (x.base64 ? (x.base64.length * 3) / 4 : (x.texto || "").length), 0);
