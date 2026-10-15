import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export const UA = "Mozilla/5.0 (compatible; SograpeInnovationRadar/1.0; +https://www.sogrape.com)";

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" };
export const decodeEntities = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

/** HTML → texto simples, com parágrafos. */
export function htmlToText(html: string): string {
  return decodeEntities(html
    .replace(/<(script|style|noscript|iframe|figure|figcaption)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ").replace(/\n\s*/g, "\n").replace(/\n{2,}/g, "\n\n").trim();
}

/** Vai buscar a página e extrai o corpo do artigo com o Readability. */
export async function extractArticle(url: string, timeoutMs = 20000): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const { document } = parseHTML(html);
  const art = new Readability(document as unknown as Document).parse();
  return art?.content ? htmlToText(art.content) : htmlToText(html);
}

export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pré-filtro barato: o texto tem alguma palavra-chave? Devolve as que encontrou. */
export function matchKeywords(text: string, keywords: string[]): string[] {
  const t = fold(text);
  const hits: string[] = [];
  for (const k of keywords) {
    const kw = fold(k.trim());
    if (!kw) continue;
    if (new RegExp(`(^|[^a-z0-9])${esc(kw)}($|[^a-z0-9])`).test(t)) hits.push(k);
  }
  return hits;
}

export type Page = { url: string; titulo: string; site: string; data: string | null; autor?: string; texto: string };

/** Página completa com metadados (para adicionar uma notícia à mão a partir do link). */
export async function extractPage(url: string, timeoutMs = 20000): Promise<Page> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const { document } = parseHTML(html);
  const meta = (sel: string) => document.querySelector(sel)?.getAttribute("content")?.trim() || "";
  const host = new URL(r.url || url).hostname.replace(/^www\./, "");
  const rawDate = meta('meta[property="article:published_time"]') || meta('meta[name="date"]') || meta('meta[itemprop="datePublished"]')
    || document.querySelector("time[datetime]")?.getAttribute("datetime") || "";
  const t = Date.parse(rawDate);
  const titulo = decodeEntities(meta('meta[property="og:title"]') || document.querySelector("title")?.textContent?.trim() || "");
  const site = decodeEntities(meta('meta[property="og:site_name"]')) || host;
  const autor = meta('meta[name="author"]') || undefined;
  const art = new Readability(document as unknown as Document).parse();
  const texto = art?.content ? htmlToText(art.content) : htmlToText(html);
  return { url: r.url || url, titulo: titulo || art?.title || host, site, data: isNaN(t) ? null : new Date(t).toISOString(), autor, texto };
}
