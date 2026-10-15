"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Publicado, Signal } from "./types";
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

export async function saveEdit(s: Signal, f: Pick<Signal, "titulo" | "resumo" | "area" | "categoria">) {
  const upd: Record<string, any> = { ...f, atualizadoEm: nowIso() };
  // Só uma notícia aprovada atualiza logo o radar; as pendentes esperam pela aprovação
  if (s.status === "approved") upd.publicado = buildPublicado(s, f);
  await updateDoc(ref(s.id), upd);
}

export async function restore(p: Snapshot) {
  await updateDoc(ref(p.id), { ...p.data, atualizadoEm: nowIso() });
}
