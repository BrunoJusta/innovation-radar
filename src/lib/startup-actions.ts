"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Startup, StartupOrigem } from "./types";
import { nowIso } from "./util";

const ref = (id: string) => doc(db, "startups", id);
export type StartupEdit = Pick<Startup, "nome" | "site" | "pais" | "cidade" | "fundacao" | "fase" | "setor" | "cadeia" | "descricao" | "porque" | "relevancia" | "financiamento" | "investidores">;

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
/**
 * Apaga da base de dados uma startup rejeitada, com as análises. Fica só uma marca em startupSeen
 * (nome, site e motivo) para a recolha semanal não a voltar a propor. Uma startup ligada ao pipeline não é apagada.
 */
export async function purgeStartup(s: Pick<Startup, "id" | "nome" | "site" | "dealId">, motivo: string) {
  if (s.dealId) return;
  // Se a marca já existir (foi rejeitada antes), fica a que estava
  await setDoc(doc(db, "startupSeen", s.id), { nome: s.nome, site: s.site || "", motivo: `rejeitada: ${motivo}`, visto: nowIso() }).catch(() => {});
  const an = await getDocs(collection(db, "startups", s.id, "analises"));
  await Promise.all(an.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(ref(s.id));
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

/** Marca a ficha como estando no pipeline (fica aprovada; só sai da lista de Aprovadas). Os passos em espera já passaram para a ficha do pipeline. */
export const saveStartupLink = (id: string, dealId: string) => updateDoc(ref(id), { dealId, pipelineEm: nowIso(), passosEmEspera: deleteField(), atualizadoEm: nowIso() });
