"use client";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { post } from "./api";
import { Analise, AnaliseFonte, AnaliseResumo } from "./types";
import { nowIso } from "./util";

/** O que se analisa: uma startup do radar (startups/{id}) ou uma do pipeline (deals/{id}). */
export type AlvoAnalise = { path: string; nome: string; site: string; dominio: string; descricao: string; setor: string; /** Outro documento que também guarda o resumo (ex.: o do pipeline). */ alsoResumo?: string };
export type ParteId = "empresa" | "equipa";
export type Parte = { parte: ParteId; dados: unknown; fontes: AnaliseFonte[] };
export type Passo = "espera" | "a correr" | "ok" | "erro";
export type Passos = Record<ParteId | "avaliar", Passo>;

const MSG504 = "A Gemini demorou demasiado e o pedido foi interrompido. Tenta outra vez.";

export const resumoDe = (a: Analise): AnaliseResumo => ({
  decisao: a.decisao, ticket: a.ticket, desafio: a.desafio, feitaEm: a.feitaEm,
  positivos: a.criterios.filter((c) => c.veredicto === "positivo").length,
});

/** Guarda uma análise nova (as anteriores ficam no histórico) e o resumo no documento. */
export async function saveAnalise(path: string, a: Analise, alsoResumo?: string) {
  const { id: _id, ...data } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
  const r = await addDoc(collection(db, path, "analises"), JSON.parse(JSON.stringify(data)));
  await updateDoc(doc(db, path), { analiseResumo: resumoDe(a), atualizadoEm: nowIso() });
  if (alsoResumo) await updateDoc(doc(db, alsoResumo), { analiseResumo: resumoDe(a) }).catch(() => {});
  return r.id;
}

/** Últimas análises, da mais recente para a mais antiga. */
export async function loadAnalises(path: string, n = 5): Promise<Analise[]> {
  const q = query(collection(db, path, "analises"), orderBy("feitaEm", "desc"), limit(n));
  return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }) as Analise);
}

export class AnaliseErro extends Error { constructor(m: string, public partes: Partial<Record<ParteId, Parte>>) { super(m); } }

/**
 * Corre a análise em três pedidos curtos (empresa e equipa em paralelo, depois a avaliação) e guarda-a.
 * Em caso de erro, devolve as partes já feitas para se tentar outra vez só o que falhou.
 */
export async function runAnalise(alvo: AlvoAnalise, email: string, onStep: (p: Passos) => void = () => {}, jaTem: Partial<Record<ParteId, Parte>> = {}) {
  const startup = { nome: alvo.nome, site: alvo.site, setor: alvo.setor, descricao: alvo.descricao };
  const st: Passos = { empresa: jaTem.empresa ? "ok" : "a correr", equipa: jaTem.equipa ? "ok" : "a correr", avaliar: "espera" };
  onStep({ ...st });
  const got: Partial<Record<ParteId, Parte>> = { ...jaTem };
  const falhas: string[] = [];
  await Promise.all((["empresa", "equipa"] as ParteId[]).filter((p) => !jaTem[p]).map(async (p) => {
    try { got[p] = await post<Parte>("/api/startups/analise", { etapa: "perfil", parte: p, startup }, MSG504); st[p] = "ok"; }
    catch (e) { st[p] = "erro"; falhas.push((e as Error).message); }
    onStep({ ...st });
  }));
  if (falhas.length) throw new AnaliseErro(falhas[0], got);
  st.avaliar = "a correr"; onStep({ ...st });
  try {
    const r = await post<{ analise: Omit<Analise, "feitaEm" | "por" | "modelo">; comGuidelines: boolean }>("/api/startups/analise",
      { etapa: "avaliar", startup, partes: [got.empresa, got.equipa] }, MSG504);
    const a: Analise = { ...r.analise, feitaEm: new Date().toISOString(), por: email, modelo: "gemini" };
    const id = await saveAnalise(alvo.path, a, alvo.alsoResumo);
    st.avaliar = "ok"; onStep({ ...st });
    return { analise: { ...a, id }, comGuidelines: r.comGuidelines };
  } catch (e) {
    st.avaliar = "erro"; onStep({ ...st });
    throw new AnaliseErro((e as Error).message, got);
  }
}
