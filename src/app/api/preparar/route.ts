/**
 * Prepara uma notícia a partir de um link (ou de texto colado): lê a página, pede à Gemini a
 * classificação e o resumo, e devolve um rascunho. Não grava nada: quem grava é o backoffice,
 * depois de a pessoa rever e editar.
 * Requer GEMINI_API_KEY nas variáveis de ambiente da Vercel.
 */
import { NextResponse } from "next/server";
import { extractPage, htmlToText, type Page } from "../../../../pipeline/lib/text";
import { classify, embed } from "../../../../pipeline/lib/gemini";
import { normalizeUrl, urlHash } from "../../../../pipeline/lib/url";
import { memberFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

type Opt = { id: string; nome: string; descricao: string; tipo?: "tematica" | "tecnologia" | "canal" };

const fail = (msg: string, status = 400) => NextResponse.json({ erro: msg }, { status });

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return fail("Sem sessão ou sem acesso ao backoffice.", 401);
  if (!process.env.GEMINI_API_KEY) return fail("Falta configurar a GEMINI_API_KEY na Vercel.", 500);

  let body: { url?: string; texto?: string; titulo?: string; areas?: Opt[]; cats?: Opt[] };
  try { body = await req.json(); } catch { return fail("Pedido inválido."); }
  const url = (body.url || "").trim();
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return fail("Indica um link que comece por http.");
  const areas = (body.areas || []).slice(0, 20), cats = (body.cats || []).slice(0, 60);
  if (!areas.length || !cats.length) return fail("Não há cadeias de valor ou tags configuradas.");

  // Texto: o que foi colado tem prioridade; senão, lê a página
  let page: Page = { url, titulo: (body.titulo || "").trim(), site: new URL(url).hostname.replace(/^www\./, ""), data: null, texto: htmlToText(body.texto || "") };
  let aviso: string | undefined;
  try {
    const p = await extractPage(url);
    page = { ...p, titulo: page.titulo || p.titulo, texto: page.texto.length > 200 ? page.texto : p.texto };
  } catch (e) {
    if (page.texto.length < 200) return fail(`Não foi possível ler a página (${(e as Error).message}). Cola o texto do artigo e tenta outra vez.`, 422);
    aviso = "A página não deixou ler o conteúdo; foi usado o texto colado.";
  }
  if (page.texto.length < 200) return fail("A página não tem texto suficiente (pode ser paga ou feita em JavaScript). Cola o texto do artigo e tenta outra vez.", 422);

  try {
    const c = await classify({ titulo: page.titulo, site: page.site, data: page.data || new Date().toISOString(), texto: page.texto }, areas, cats);
    const vec = await embed(`${c.titulo_pt}\n${c.resumo_pt}`).catch(() => null);
    return NextResponse.json({
      aviso,
      rascunho: {
        titulo: c.titulo_pt, resumo: c.resumo_pt, porque: c.porque_pt, entidades: c.entidades.slice(0, 6),
        area: c.area, tags: c.tags, relevancia: c.relevancia,
        dataPublicacao: page.data || new Date().toISOString(),
        fonte: { site: page.site, sourceId: "manual", url: normalizeUrl(page.url), urlHash: urlHash(page.url), tituloOriginal: page.titulo, data: page.data || new Date().toISOString(), ...(page.autor ? { autor: page.autor } : {}) },
      },
      vec,
    });
  } catch (e) {
    return fail(`A Gemini não conseguiu preparar a notícia: ${(e as Error).message.slice(0, 200)}`, 502);
  }
}
