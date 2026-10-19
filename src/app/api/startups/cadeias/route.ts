/** Atribui a cadeia de valor (anel do radar) a startups que ainda não a têm, pela descrição. Não grava nada. */
import { NextResponse } from "next/server";
import { cadeiasDe, classificarCadeias } from "../../../../../pipeline/lib/startups";
import { memberFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
const fail = (erro: string, status = 400) => NextResponse.json({ erro }, { status });

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return fail("Sem sessão ou sem acesso ao backoffice.", 401);
  if (!process.env.GEMINI_API_KEY) return fail("Falta configurar a GEMINI_API_KEY na Vercel.", 500);
  let body: { startups?: { id: string; nome: string; descricao: string; setor?: string }[]; cadeias?: unknown };
  try { body = await req.json(); } catch { return fail("Pedido inválido."); }
  const lista = (body.startups || []).filter((s) => s && typeof s.id === "string" && s.nome).slice(0, 80)
    .map((s) => ({ id: s.id, nome: String(s.nome).slice(0, 120), descricao: String(s.descricao || "").slice(0, 600), setor: String(s.setor || "").slice(0, 80) }));
  if (!lista.length) return NextResponse.json({ cadeias: {} });
  try {
    return NextResponse.json({ cadeias: await classificarCadeias(lista, { timeoutMs: 50000 }, cadeiasDe(body.cadeias)) });
  } catch (e) {
    return fail(`A classificação falhou: ${(e as Error).message.slice(0, 200)}`, 502);
  }
}
