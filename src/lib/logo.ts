"use client";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "./firebase";
import { post } from "./api";

/** Reduz uma imagem (ficheiro ou data URL) para no máximo `lado` px, em PNG, para ficar leve na ficha. */
export async function reduzirImagem(src: File | string, lado = 128): Promise<string> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Não foi possível ler a imagem.")); i.src = url; });
    const w0 = img.naturalWidth || lado, h0 = img.naturalHeight || lado, k = Math.min(1, lado / Math.max(w0, h0));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally { if (typeof src !== "string") URL.revokeObjectURL(url); }
}

/** Grava (ou tira, com null) o logótipo na startup do radar e/ou na ficha do pipeline. */
export async function guardarLogo(alvo: { startupId?: string; dealId?: string }, logo: string | null) {
  const v = logo ? logo : deleteField();
  await Promise.all([
    alvo.startupId ? updateDoc(doc(db, "startups", alvo.startupId), { logo: v }) : null,
    alvo.dealId ? updateDoc(doc(db, "deals", alvo.dealId), { logo: v }).catch(() => {}) : null,
  ]);
}

/** Procura o logótipo no site da startup; devolve-o já reduzido, ou null. */
export async function procurarLogo(site: string): Promise<string | null> {
  if (!site) return null;
  const j = await post<{ logo: string | null }>("/api/startups/logo", { site });
  if (!j.logo) return null;
  try { return await reduzirImagem(j.logo); } catch { return j.logo; }
}

/** Procura e grava, sem avisar se falhar (usado depois de adicionar startups e de fazer a análise). */
export async function procurarEGuardar(site: string, alvo: { startupId?: string; dealId?: string }) {
  try { const l = await procurarLogo(site); if (l) await guardarLogo(alvo, l); return l; } catch { return null; }
}
