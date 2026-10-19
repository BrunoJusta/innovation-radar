"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import { AREAS_LISTA } from "./taxonomia";
import { CATEGORIAS_LISTA } from "./categorias";
import type { Area, Sector } from "./types";

/** Uma coleção ordenada, com uma só ligação ao Firestore para todos os componentes que a usam. */
type Item = { id: string; nome: string; descricao: string; cor: string; ordem: number };
const store: Record<string, { cache: Item[] | null; subs: Set<(a: Item[]) => void>; unsub: (() => void) | null }> = {};

function useColecao<T extends Item>(nome: string, fallback: T[]): T[] {
  const st = (store[nome] ||= { cache: null, subs: new Set(), unsub: null });
  const [l, setL] = useState<T[]>((st.cache as T[]) || fallback);
  useEffect(() => {
    const f = (a: Item[]) => setL(a as T[]);
    st.subs.add(f);
    if (!st.unsub) st.unsub = onSnapshot(query(collection(db, nome), orderBy("ordem")), (s) => {
      const docs = s.docs.map((d) => ({ id: d.id, ...d.data() }) as Item);
      st.cache = docs.length ? docs : null;
      st.subs.forEach((g) => g(st.cache || fallback));
    }, () => {});
    else if (st.cache) setL(st.cache as T[]);
    return () => { st.subs.delete(f); if (!st.subs.size && st.unsub) { st.unsub(); st.unsub = null; } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return l;
}

/** Cadeias de valor (coleção «areas»): comuns às notícias e às startups, editadas em Definições › Geral › Cadeias de valor. */
export const useAreas = (): Area[] => useColecao<Area>("areas", AREAS_LISTA);
/** Categorias das startups (coleção «sectors»): o tipo de solução. */
export const useCategorias = (): Sector[] => useColecao<Sector>("sectors", CATEGORIAS_LISTA as Sector[]);

/** Só o que a Gemini precisa de cada item (para mandar às rotas /api). */
export const cadeiasParaApi = (a: { id: string; nome: string; descricao: string }[]) => a.map(({ id, nome, descricao }) => ({ id, nome, descricao }));
