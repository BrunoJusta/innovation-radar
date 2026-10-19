/**
 * Migração para a taxonomia v2 (cadeias de valor + temáticas, tecnologias e canais).
 * Corre no início da recolha diária: troca a estrutura uma vez e reclassifica, aos poucos, as notícias sem tags.
 */
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { AREAS_V2, TAGS_V2, TAXONOMIA_VERSAO } from "../../src/lib/taxonomia";
import type { Area, Category, Signal } from "../../src/lib/types";

export type Reclass = { feitas: number; tentadas: number; faltam: number; erros: string[] };
import { classifyTags } from "./gemini";

type Log = (...a: unknown[]) => void;

/** Troca as áreas e as categorias pelas da v2 (uma só vez). Devolve true se trocou agora. */
export async function migrarEstrutura(db: Firestore, log: Log, dry: boolean): Promise<boolean> {
  const set = await db.doc("settings/geral").get();
  if ((set.data()?.taxonomia || 1) >= TAXONOMIA_VERSAO) return false;
  if (dry) { log("Taxonomia v2 por instalar (dry run: não mexe)."); return false; }
  const [aS, cS] = await Promise.all([db.collection("areas").get(), db.collection("categories").get()]);
  const b = db.batch();
  aS.docs.filter((d) => !(d.id in AREAS_V2)).forEach((d) => b.delete(d.ref));
  cS.docs.filter((d) => !(d.id in TAGS_V2)).forEach((d) => b.delete(d.ref));
  Object.entries(AREAS_V2).forEach(([id, v]) => b.set(db.doc(`areas/${id}`), v));
  Object.entries(TAGS_V2).forEach(([id, v]) => b.set(db.doc(`categories/${id}`), v));
  b.set(db.doc("settings/geral"), { taxonomia: TAXONOMIA_VERSAO }, { merge: true });
  await b.commit();
  log(`Taxonomia v2 instalada: ${Object.keys(AREAS_V2).length} cadeias de valor e ${Object.keys(TAGS_V2).length} tags.`);
  return true;
}

/** Reclassifica com a Gemini as notícias sem tags (até `max` por execução). As aprovadas mudam também no radar. */
export async function reclassificar(db: Firestore, areas: Area[], cats: Category[], log: Log, dry: boolean, max = 400): Promise<Reclass> {
  const st: Reclass = { feitas: 0, tentadas: 0, faltam: 0, erros: [] };
  const snap = await db.collection("signals").get();
  const falta = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Signal).filter((s) => s.status !== "rejected" && !(s.tags && s.tags.length));
  if (!falta.length) return st;
  log(`Reclassificar ${falta.length} notícias (máx. ${max} nesta execução)`);
  const okArea = new Set(areas.map((a) => a.id));
  for (const s of falta.slice(0, max)) {
    st.tentadas++;
    try {
      const r = await classifyTags({ titulo: s.titulo, resumo: s.resumo, porque: s.porque || "" }, areas, cats);
      if (!okArea.has(r.area) || !r.tags.length) throw new Error("classificação incompleta");
      const upd: Record<string, unknown> = { area: r.area, tags: r.tags, categoria: FieldValue.delete() };
      if (s.status === "approved" && s.publicado) Object.assign(upd, { "publicado.area": r.area, "publicado.tags": r.tags, "publicado.categoria": FieldValue.delete() });
      if (!dry) await db.doc(`signals/${s.id}`).update(upd);
      st.feitas++;
    } catch (e) { st.erros.push(`${s.titulo.slice(0, 60)}: ${(e as Error).message.slice(0, 160)}`); }
  }
  st.faltam = Math.max(0, falta.length - st.feitas);
  log(`Reclassificadas: ${st.feitas} de ${st.tentadas}; faltam ${st.faltam}`);
  return st;
}
