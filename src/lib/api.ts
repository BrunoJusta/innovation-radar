"use client";
import { auth } from "./firebase";

/** POST autenticado às rotas /api do backoffice. */
export async function post<T>(path: string, body: unknown, msg504 = "O pedido demorou demasiado e foi interrompido. Tenta outra vez."): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ erro: r.status === 504 ? msg504 : `Erro ${r.status}` }));
  if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
  return j as T;
}
