"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { Startup, StartupOrigem } from "./types";
import { hojeLocal, nowIso } from "./util";

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

/* ---------- Mudança de nome (a startup continua a mesma, mudou de nome) ---------- */

/** Onde o nome aparece: ficha do radar de startups, fichas do pipeline, projetos e eventos com a startup como parceiro. */
export type PlanoNome = {
  antigo: string; novo: string; startupId?: string;
  deals: { id: string; ref: string }[]; projetos: { id: string; ref: string }[]; eventos: { id: string; ref: string }[];
};
const mesmoNome = (a: string, b: string) => !!a.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();

export async function planoNome(alvo: { startupId?: string; dealId?: string }, antigo: string, novo: string): Promise<PlanoNome> {
  const sid = alvo.startupId;
  const dealIds = new Set<string>(alvo.dealId ? [alvo.dealId] : []);
  if (sid) {
    const st = await getDoc(ref(sid)).catch(() => null);
    const dId = st?.exists() ? (st.data() as Startup).dealId : undefined;
    if (dId) dealIds.add(dId);
    // O pipeline só é visível para administradores: sem acesso, fica de fora
    const l = await getDocs(query(collection(db, "deals"), where("startupId", "==", sid))).catch(() => null);
    l?.docs.forEach((x) => dealIds.add(x.id));
  }
  const deals = (await Promise.all([...dealIds].map((id) => getDoc(doc(db, "deals", id)).catch(() => null))))
    .flatMap((x) => (x?.exists() ? [{ id: x.id, ref: (x.data()?.ref as string) || "" }] : []));
  // Projetos e eventos: ligados à startup ou com ela como parceiro (pelo nome ou pela referência de parceiro)
  const [pl, el] = await Promise.all(["projects", "events"].map((c) => getDocs(collection(db, c)).then((r) => r.docs.map((x) => ({ id: x.id, ...x.data() } as any))).catch(() => [] as any[])));
  const doParceiro = (x: any) => (!!sid && x.startupId === sid) || mesmoNome(x.parceiro || "", antigo);
  const refs = new Set([...pl, ...el].filter(doParceiro).map((x) => x.parceiroRef).filter(Boolean));
  const usa = (x: any) => doParceiro(x) || refs.has(x.parceiroRef);
  return {
    antigo, novo, startupId: sid, deals,
    projetos: pl.filter(usa).map((x) => ({ id: x.id, ref: x.ref || x.nome || "" })),
    eventos: el.filter(usa).map((x) => ({ id: x.id, ref: x.ref || x.nome || "" })),
  };
}

/** Texto do pop-up de validação: onde o nome vai mudar. */
export function textoPlano(p: PlanoNome) {
  const n = (k: number, um: string, varios: string) => `${k} ${k === 1 ? um : varios}`;
  const onde = [
    p.startupId ? "na ficha do radar de startups" : "",
    p.deals.length ? `no pipeline${p.deals.some((d) => d.ref) ? ` (${p.deals.map((d) => d.ref).filter(Boolean).join(", ")})` : ""}` : "",
    p.projetos.length ? `em ${n(p.projetos.length, "projeto", "projetos")} (${p.projetos.map((x) => x.ref).join(", ")})` : "",
    p.eventos.length ? `em ${n(p.eventos.length, "evento", "eventos")} (${p.eventos.map((x) => x.ref).join(", ")})` : "",
  ].filter(Boolean);
  const lista = onde.length > 1 ? `${onde.slice(0, -1).join(", ")} e ${onde.at(-1)}` : onde[0] || "nesta ficha";
  return `É a mesma startup com outro nome: o site, a análise e o histórico ficam. O nome muda ${lista}.${p.deals.length ? " A mudança fica registada na cronologia do pipeline." : ""} O nome antigo fica guardado para continuar a aparecer nas pesquisas.`;
}

/** Muda o nome em todo o lado de uma vez (ou tudo ou nada). */
export async function aplicarNome(p: PlanoNome, by: string) {
  const b = writeBatch(db), agora = nowIso(), novo = p.novo.trim();
  if (p.startupId) b.update(ref(p.startupId), { nome: novo, nomesAnteriores: arrayUnion(p.antigo), atualizadoEm: agora });
  for (const d of p.deals) {
    b.update(doc(db, "deals", d.id), { nome: novo, nomesAnteriores: arrayUnion(p.antigo), atualizadoEm: agora });
    b.set(doc(collection(db, "deals", d.id, "interacoes")), { data: hojeLocal(), tipo: "nota", texto: `Mudou de nome: «${p.antigo}» passou a «${novo}».`, por: by, criadoEm: agora });
  }
  for (const x of p.projetos) b.update(doc(db, "projects", x.id), { parceiro: novo, atualizadoEm: agora });
  for (const x of p.eventos) b.update(doc(db, "events", x.id), { parceiro: novo, atualizadoEm: agora });
  await b.commit();
}
