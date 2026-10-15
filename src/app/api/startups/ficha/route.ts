/** Prepara a ficha de uma startup a partir do site (pesquisa online). Não grava nada. */
import { NextResponse } from "next/server";
import { checkSite, domainOf, profile } from "../../../../../pipeline/lib/startups";
import { memberFromRequest } from "@/lib/server/auth";
import type { Sector } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
const fail = (erro: string, status = 400) => NextResponse.json({ erro }, { status });

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return fail("Sem sessão ou sem acesso ao backoffice.", 401);
  if (!process.env.GEMINI_API_KEY) return fail("Falta configurar a GEMINI_API_KEY na Vercel.", 500);
  let body: { site?: string; nome?: string; sectors?: Sector[] };
  try { body = await req.json(); } catch { return fail("Pedido inválido."); }
  const site = (body.site || "").trim(), sectors = (body.sectors || []).slice(0, 20);
  if (!domainOf(site)) return fail("Indica o site da startup, por exemplo startup.com");
  if (!sectors.length) return fail("Não há setores configurados.");
  try {
    const [c, chk] = await Promise.all([profile(site, sectors, body.nome || ""), checkSite(/^https?:/.test(site) ? site : `https://${site}`)]);
    if (!c) return fail("Não foi possível encontrar informação sobre esta startup. Confirma o site.", 422);
    return NextResponse.json({ ficha: c, siteOk: chk.ok });
  } catch (e) {
    return fail(`A pesquisa falhou: ${(e as Error).message.slice(0, 200)}`, 502);
  }
}
