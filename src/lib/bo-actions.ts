"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDoc, collection, deleteField, doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Fonte, Publicado, Signal } from "./types";
import { nowIso } from "./util";

export function buildPublicado(s: Signal, over: Partial<Signal> = {}): Publicado {
  const x = { ...s, ...over };
  return {
    titulo: x.titulo, resumo: x.resumo, area: x.area, categoria: x.categoria, entidades: x.entidades || [],
    fontes: (x.fontes || []).map((f) => ({ titulo: f.tituloOriginal, url: f.url })),
    dataPublicacao: x.dataPublicacao, relevancia: x.relevancia, destaque: !!x.destaque,
  };
}

const ref = (id: string) => doc(db, "signals", id);

/** Guarda os campos anteriores para o botão Anular. */
export type Snapshot = { id: string; data: Record<string, any> };
const snap = (s: Signal, keys: (keyof Signal)[]): Snapshot => ({
  id: s.id, data: Object.fromEntries(keys.map((k) => [k, s[k] === undefined ? deleteField() : s[k]])),
});
const KEYS: (keyof Signal)[] = ["status", "noRadar", "publicado", "motivoRejeicao", "flagNovaFonte", "aprovadoEm", "aprovadoPor", "destaque", "titulo", "resumo", "area", "categoria"];

export async function approve(s: Signal, by: string): Promise<Snapshot> {
  const prev = snap(s, KEYS);
  await updateDoc(ref(s.id), {
    status: "approved", noRadar: true, publicado: buildPublicado(s), flagNovaFonte: false,
    motivoRejeicao: deleteField(), aprovadoEm: nowIso(), aprovadoPor: by, atualizadoEm: nowIso(),
  });
  return prev;
}

export async function reject(s: Signal, motivo: string): Promise<Snapshot> {
  const prev = snap(s, KEYS);
  await updateDoc(ref(s.id), { status: "rejected", motivoRejeicao: motivo, noRadar: false, publicado: null, flagNovaFonte: false, atualizadoEm: nowIso() });
  return prev;
}

export async function backToTriage(s: Signal): Promise<Snapshot> {
  const prev = snap(s, KEYS);
  await updateDoc(ref(s.id), { status: "pending", noRadar: false, publicado: null, motivoRejeicao: deleteField(), atualizadoEm: nowIso() });
  return prev;
}

export async function toggleStar(s: Signal) {
  const d = !s.destaque;
  const upd: Record<string, any> = { destaque: d, atualizadoEm: nowIso() };
  if (s.status === "approved" && s.publicado) upd["publicado.destaque"] = d;
  await updateDoc(ref(s.id), upd);
}

export type EditFields = Pick<Signal, "titulo" | "resumo" | "porque" | "entidades" | "area" | "categoria" | "relevancia" | "dataPublicacao">;

export async function saveEdit(s: Signal, f: Partial<EditFields>) {
  const upd: Record<string, any> = { ...f, atualizadoEm: nowIso() };
  // Só uma notícia aprovada atualiza logo o radar; as pendentes esperam pela aprovação
  if (s.status === "approved") upd.publicado = buildPublicado(s, f);
  await updateDoc(ref(s.id), upd);
}

export async function restore(p: Snapshot) {
  await updateDoc(ref(p.id), { ...p.data, atualizadoEm: nowIso() });
}

/** Rascunho preparado pela Gemini a partir de um link, depois de revisto no backoffice. */
export type Draft = EditFields & { destaque: boolean; fonte: Fonte };

/** Grava uma notícia adicionada à mão: vai para a triagem ou é logo aprovada. */
export async function createManual(d: Draft, vec: number[] | null, by: string, aprovar: boolean): Promise<string> {
  const { fonte: f0, ...f } = d;
  const fonte = Object.fromEntries(Object.entries(f0).filter(([, x]) => x !== undefined && x !== "")) as Fonte;
  const base: Omit<Signal, "id"> = {
    ...f, entidades: f.entidades.slice(0, 8), fontes: [fonte], status: "pending", noRadar: false, publicado: null,
    criadoEm: nowIso(), atualizadoEm: nowIso(), manual: true, criadoPor: by,
  };
  const data = aprovar
    ? { ...base, status: "approved" as const, noRadar: true, publicado: buildPublicado({ id: "", ...base }), aprovadoEm: nowIso(), aprovadoPor: by }
    : base;
  const ref = await addDoc(collection(db, "signals"), data);
  // Para a recolha diária não voltar a trazer o mesmo link e conseguir juntar notícias iguais de outros sites
  await Promise.allSettled([
    setDoc(doc(db, "seen", fonte.urlHash), { url: fonte.url, sourceId: "manual", motivo: "manual", visto: nowIso(), expira: Timestamp.fromMillis(Date.now() + 90 * 864e5) }),
    vec ? setDoc(doc(db, "embeddings", ref.id), { vec, data: d.dataPublicacao, criadoEm: nowIso() }) : Promise.resolve(),
  ]);
  return ref.id;
}
