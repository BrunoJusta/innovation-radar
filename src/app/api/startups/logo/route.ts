/** Procura o logótipo de uma startup a partir do site. Não grava nada: devolve um data URL. */
import { NextResponse } from "next/server";
import { procurarLogo } from "../../../../../pipeline/lib/logo";
import { memberFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return NextResponse.json({ erro: "Sem sessão ou sem acesso ao backoffice." }, { status: 401 });
  let body: { site?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 }); }
  const site = String(body.site || "").trim().slice(0, 300);
  if (!site) return NextResponse.json({ logo: null });
  return NextResponse.json({ logo: await procurarLogo(site, 7000) });
}
