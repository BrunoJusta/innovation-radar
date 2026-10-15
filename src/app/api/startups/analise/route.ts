/**
 * Análise de investimento em passos curtos (cada um cabe nos 60 s da Vercel):
 * etapa "perfil" (parte empresa ou equipa, com pesquisa na web) e etapa "avaliar" (critérios e decisão).
 * Não grava nada: o backoffice guarda o resultado.
 */
import { NextResponse } from "next/server";
import { avaliar, juntaPerfil, ParteId, ParteResultado, perfilParte } from "../../../../../pipeline/lib/analise";
import { memberFromRequest, readTextField } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
const fail = (erro: string, status = 400) => NextResponse.json({ erro }, { status });

type Body = {
  etapa?: "perfil" | "avaliar"; parte?: ParteId;
  startup?: { nome?: string; site?: string; setor?: string; descricao?: string };
  partes?: ParteResultado[];
};

export async function POST(req: Request) {
  if (!(await memberFromRequest(req))) return fail("Sem sessão ou sem acesso ao backoffice.", 401);
  if (!process.env.GEMINI_API_KEY) return fail("Falta configurar a GEMINI_API_KEY na Vercel.", 500);
  let b: Body;
  try { b = await req.json(); } catch { return fail("Pedido inválido."); }
  const st = { nome: (b.startup?.nome || "").slice(0, 120), site: (b.startup?.site || "").slice(0, 200), setor: (b.startup?.setor || "").slice(0, 80), descricao: (b.startup?.descricao || "").slice(0, 1200) };
  if (!st.nome && !st.site) return fail("Falta o nome ou o site da startup.");
  try {
    if (b.etapa === "perfil") {
      if (b.parte !== "empresa" && b.parte !== "equipa") return fail("Parte desconhecida.");
      const r = await perfilParte(b.parte, st.nome, st.site, { fast: true, think: 1024, timeoutMs: 52000 });
      return NextResponse.json(r);
    }
    if (b.etapa === "avaliar") {
      if (!Array.isArray(b.partes) || !b.partes.length) return fail("Falta o perfil.");
      const { perfil, fontes } = juntaPerfil(b.partes.slice(0, 2));
      const guidelines = await readTextField(req, "config/investimento", "texto");
      const a = await avaliar(st, perfil, fontes, guidelines, { fast: true, timeoutMs: 52000 });
      return NextResponse.json({ analise: a, comGuidelines: !!guidelines });
    }
    return fail("Etapa desconhecida.");
  } catch (e) {
    const m = (e as Error).message;
    const timeout = /aborted|timeout/i.test(m);
    return fail(timeout ? "A Gemini demorou demasiado. Tenta outra vez." : `A análise falhou: ${m.slice(0, 200)}`, timeout ? 504 : 502);
  }
}
