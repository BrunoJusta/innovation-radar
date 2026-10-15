"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDoc, collection, deleteField, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Analise, AnaliseResumo, Startup, StartupOrigem } from "./types";
import { nowIso } from "./util";

const ref = (id: string) => doc(db, "startups", id);
export type StartupEdit = Pick<Startup, "nome" | "site" | "pais" | "cidade" | "fundacao" | "fase" | "setor" | "descricao" | "porque" | "relevancia" | "financiamento" | "investidores">;

/** Campos anteriores para o botão Anular. */
export type SSnapshot = { id: string; data: Record<string, any> };
const KEYS: (keyof Startup)[] = ["status", "motivoRejeicao", "aprovadoEm", "aprovadoPor", "destaque", "flagNovaInfo"];
const snap = (s: Startup): SSnapshot => ({ id: s.id, data: Object.fromEntries(KEYS.map((k) => [k, s[k] === undefined ? deleteField() : s[k]])) });

export async function approveStartup(s: Startup, by: string) {
  const prev = snap(s);
  await updateDoc(ref(s.id), { status: "approved", aprovadoEm: nowIso(), aprovadoPor: by, motivoRejeicao: deleteField(), flagNovaInfo: false, atualizadoEm: nowIso() });
  return prev;
}
export async function rejectStartup(s: Startup, motivo: string) {
  const prev = snap(s);
  await updateDoc(ref(s.id), { status: "rejected", motivoRejeicao: motivo, atualizadoEm: nowIso() });
  return prev;
}
export async function startupBackToTriage(s: Startup) {
  const prev = snap(s);
  await updateDoc(ref(s.id), { status: "pending", motivoRejeicao: deleteField(), atualizadoEm: nowIso() });
  return prev;
}
export const toggleStartupStar = (s: Startup) => updateDoc(ref(s.id), { destaque: !s.destaque, atualizadoEm: nowIso() });
export const restoreStartup = (p: SSnapshot) => updateDoc(ref(p.id), { ...p.data, atualizadoEm: nowIso() });

export async function saveStartup(s: Startup, f: StartupEdit) {
  const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === undefined || (k === "cidade" && !v) ? deleteField() : v]));
  await updateDoc(ref(s.id), { ...clean, atualizadoEm: nowIso() });
}

/** Nova startup vinda da pesquisa no backoffice ou de "adicionar por site". Se já existir, só junta a origem. */
export async function createStartup(id: string, f: StartupEdit & { dominio: string }, origem: StartupOrigem, by: string, aprovar = false): Promise<"criada" | "existia"> {
  const r = ref(id);
  const ex = await getDoc(r);
  if (ex.exists()) {
    const s = ex.data() as Startup;
    if (!(s.origens || []).some((o) => o.url === origem.url)) await updateDoc(r, { origens: [...(s.origens || []), origem], atualizadoEm: nowIso() });
    return "existia";
  }
  const data: Record<string, any> = {
    ...f, status: aprovar ? "approved" : "pending", destaque: false, origens: [origem],
    criadoEm: nowIso(), atualizadoEm: nowIso(), manual: true, criadoPor: by,
    ...(aprovar ? { aprovadoEm: nowIso(), aprovadoPor: by } : {}),
  };
  if (!data.cidade) delete data.cidade;
  await setDoc(r, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
  return "criada";
}

/* ---------- Análise de investimento ---------- */

export const resumoDe = (a: Analise): AnaliseResumo => ({
  decisao: a.decisao, ticket: a.ticket, desafio: a.desafio, feitaEm: a.feitaEm,
  positivos: a.criterios.filter((c) => c.veredicto === "positivo").length,
});

/** Guarda uma análise nova (as anteriores ficam no histórico) e o resumo na ficha. */
export async function saveAnalise(s: Startup, a: Analise) {
  const { id: _id, ...data } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
  const r = await addDoc(collection(db, "startups", s.id, "analises"), JSON.parse(JSON.stringify(data)));
  await updateDoc(ref(s.id), { analiseResumo: resumoDe(a), atualizadoEm: nowIso() });
  return r.id;
}

/** Últimas análises de uma startup, da mais recente para a mais antiga. */
export async function loadAnalises(id: string, n = 5): Promise<Analise[]> {
  const q = query(collection(db, "startups", id, "analises"), orderBy("feitaEm", "desc"), limit(n));
  return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }) as Analise);
}
