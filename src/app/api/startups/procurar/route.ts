/** Procura startups online (Gemini + Pesquisa Google) e devolve candidatas. Não grava nada. */
import { NextResponse } from "next/server";
import { checkSite, discover } from "../../../../../pipeline/lib/startups";
import { memberFromRequest } from "@/lib/server/auth";
import type { Sector } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
const fail = (erro: string, status = 400) => NextResponse.json({ erro }, { status });

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return fail("Sem sessão ou sem acesso ao backoffice.", 401);
  if (!process.env.GEMINI_API_KEY) return fail("Falta configurar a GEMINI_API_KEY na Vercel.", 500);
  let body: { query?: string; sectors?: Sector[] };
  try { body = await req.json(); } catch { return fail("Pedido inválido."); }
  const query = (body.query || "").trim().slice(0, 200);
  const sectors = (body.sectors || []).slice(0, 20);
  if (query.length < 3) return fail("Escreve o que queres procurar.");
  if (!sectors.length) return fail("Não há setores configurados.");
  try {
    const found = await discover(query, sectors, 10);
    const checks = await Promise.all(found.map((c) => checkSite(c.site)));
    return NextResponse.json({ candidatas: found.map((c, i) => ({ ...c, siteOk: checks[i].ok })) });
  } catch (e) {
    return fail(`A pesquisa falhou: ${(e as Error).message.slice(0, 200)}`, 502);
  }
}
