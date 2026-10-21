/**
 * Procura o logótipo de uma startup a partir do site: ícones declarados na página (apple-touch-icon e ícones grandes),
 * /apple-touch-icon.png e, em último caso, o serviço de favicons da Google. Devolve um data URL (fica guardado na ficha).
 */
import { UA } from "./text";

const MAX = 200_000; // bytes

function absoluto(href: string, base: string) { try { return new URL(href, base).toString(); } catch { return ""; } }

/** Candidatos por ordem de preferência, a partir do HTML da página inicial. */
function candidatos(html: string, base: string): string[] {
  const out: { url: string; peso: number }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (tag.match(/\brel=["']([^"']+)["']/i)?.[1] || "").toLowerCase();
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href || !/icon/.test(rel)) continue;
    const tam = Math.max(0, ...(tag.match(/\bsizes=["']([^"']+)["']/i)?.[1] || "").split(/\s+/).map((x) => Number(x.split("x")[0]) || 0));
    const peso = (rel.includes("apple-touch-icon") ? 180 : 0) + tam + (/\.svg(\?|$)/i.test(href) ? 120 : 0) + (/\.ico(\?|$)/i.test(href) ? -50 : 0);
    out.push({ url: absoluto(href, base), peso });
  }
  return out.filter((x) => x.url).sort((a, b) => b.peso - a.peso).map((x) => x.url);
}

async function imagem(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!tipo.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 300 || buf.length > MAX) return null; // pequeno demais (pixel/ícone vazio) ou grande demais
    return `data:${tipo};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

export async function procurarLogo(site: string, timeoutMs = 8000): Promise<string | null> {
  const base = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  let dominio = "";
  try { dominio = new URL(base).hostname.replace(/^www\./, ""); } catch { return null; }
  const lista: string[] = [];
  try {
    const r = await fetch(base, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (r.ok) lista.push(...candidatos((await r.text()).slice(0, 300_000), r.url || base));
  } catch { /* segue para os outros */ }
  lista.push(absoluto("/apple-touch-icon.png", base));
  for (const u of lista.slice(0, 5)) { const d = await imagem(u, timeoutMs); if (d) return d; }
  // A Google devolve um ícone genérico com 404 quando não conhece o site: nesse caso fica sem logo
  return imagem(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=128`, timeoutMs);
}
