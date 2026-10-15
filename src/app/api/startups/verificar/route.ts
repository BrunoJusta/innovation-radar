/** Verifica se os sites das startups respondem (em paralelo, com limite curto). */
import { NextResponse } from "next/server";
import { checkSite } from "../../../../../pipeline/lib/startups";
import { memberFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return NextResponse.json({ erro: "Sem sessão ou sem acesso ao backoffice." }, { status: 401 });
  let body: { sites?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 }); }
  const sites = (body.sites || []).filter((x) => /^https?:\/\//.test(x)).slice(0, 12);
  const res = await Promise.all(sites.map((s) => checkSite(s, 6000)));
  return NextResponse.json({ ok: Object.fromEntries(sites.map((s, i) => [s, res[i].ok])) });
}
