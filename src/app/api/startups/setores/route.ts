/** Atribui a categoria (tipo de solução) a um lote de startups, pela descrição. Não grava nada. */
import { NextResponse } from "next/server";
import { classificarSetores } from "../../../../../pipeline/lib/startups";
import { memberFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
const fail = (erro: string, status = 400) => NextResponse.json({ erro }, { status });

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return fail("Sem sessão ou sem acesso ao backoffice.", 401);
  if (!process.env.GEMINI_API_KEY) return fail("Falta configurar a GEMINI_API_KEY na Vercel.", 500);
  let body: { startups?: { id: string; nome: string; descricao: string }[]; sectors?: { id: string; nome: string; descricao: string }[] };
  try { body = await req.json(); } catch { return fail("Pedido inválido."); }
  const lista = (body.startups || []).filter((s) => s && typeof s.id === "string" && s.nome).slice(0, 80)
    .map((s) => ({ id: s.id, nome: String(s.nome).slice(0, 120), descricao: String(s.descricao || "").slice(0, 600) }));
  const sectors = (body.sectors || []).filter((s) => s && typeof s.id === "string" && s.nome).slice(0, 20)
    .map((s) => ({ id: s.id, nome: String(s.nome).slice(0, 80), descricao: String(s.descricao || "").slice(0, 400) }));
  if (!lista.length || !sectors.length) return NextResponse.json({ setores: {} });
  try {
    return NextResponse.json({ setores: await classificarSetores(lista, sectors, { timeoutMs: 50000 }) });
  } catch (e) {
    return fail(`A classificação falhou: ${(e as Error).message.slice(0, 200)}`, 502);
  }
}
