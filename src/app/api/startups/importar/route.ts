/** Importação do dealflow: procura o site oficial e a cadeia de valor de um lote de startups. Não grava nada. */
import { NextResponse } from "next/server";
import { cadeiasDe, sitesECadeias } from "../../../../../pipeline/lib/startups";
import { memberFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
const fail = (erro: string, status = 400) => NextResponse.json({ erro }, { status });

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return fail("Sem sessão ou sem acesso ao backoffice.", 401);
  if (!process.env.GEMINI_API_KEY) return fail("Falta configurar a GEMINI_API_KEY na Vercel.", 500);
  let body: { startups?: { k: number; nome: string; descricao?: string; pais?: string; fundadores?: string }[]; cadeias?: unknown; categorias?: unknown };
  try { body = await req.json(); } catch { return fail("Pedido inválido."); }
  const lista = (body.startups || []).filter((s) => s && Number.isInteger(s.k) && s.nome).slice(0, 10).map((s) => ({
    k: s.k, nome: String(s.nome).slice(0, 120), descricao: String(s.descricao || "").slice(0, 500), pais: String(s.pais || "").slice(0, 60), fundadores: String(s.fundadores || "").slice(0, 120),
  }));
  if (!lista.length) return NextResponse.json({ startups: [] });
  try {
    return NextResponse.json({ startups: await sitesECadeias(lista, { fast: true, timeoutMs: 38000, think: 1024 }, cadeiasDe(body.cadeias), (Array.isArray(body.categorias) ? body.categorias : []).filter((x) => x && typeof x.id === "string" && x.nome).slice(0, 20).map((x) => ({ id: String(x.id), nome: String(x.nome).slice(0, 80), descricao: String(x.descricao || "").slice(0, 400) }))) });
  } catch (e) {
    return fail(`A pesquisa falhou: ${(e as Error).message.slice(0, 200)}`, 502);
  }
}
