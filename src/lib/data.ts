"use client";
import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { Area, Category, DEFAULT_SETTINGS, Settings, Signal } from "./types";

export async function loadStructure() {
  const [a, c, s] = await Promise.all([
    getDocs(query(collection(db, "areas"), orderBy("ordem"))),
    getDocs(query(collection(db, "categories"), orderBy("ordem"))),
    getDoc(doc(db, "settings", "geral")),
  ]);
  return {
    areas: a.docs.map((d) => ({ id: d.id, ...d.data() }) as Area),
    categories: c.docs.map((d) => ({ id: d.id, ...d.data() }) as Category),
    settings: { ...DEFAULT_SETTINGS, ...(s.exists() ? (s.data() as Partial<Settings>) : {}) },
  };
}

/** Notícias publicadas no radar (leitura pública permitida pelas regras). */
export async function loadPublished() {
  const snap = await getDocs(query(collection(db, "signals"), where("noRadar", "==", true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Signal).filter((s) => s.publicado);
}
