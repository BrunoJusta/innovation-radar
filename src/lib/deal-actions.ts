"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Deal, ETAPAS, Etapa, emCurso, Interacao, Passo, MotivoArquivo, MOTIVOS_ARQUIVO, ORIGENS_DF, Startup, VERTICAIS_DF, FASES_DF, VEZES, nomeDecisao } from "./types";
import { hojeLocal, nowIso, slug } from "./util";
import { AREAS_LISTA } from "./taxonomia";

const ref = (id: string) => doc(db, "deals", id);
const hoje = () => hojeLocal();
const clean = (o: Record<string, any>) => JSON.parse(JSON.stringify(o));
export const nomeEtapa = (e: string) => ETAPAS.find((x) => x.id === e)?.nome || e;
export const normNome = (s: string) => slug(s.replace(/\(.*?\)/g, "")).replace(/-/g, "");

export const DEAL_VAZIO = (): Omit<Deal, "id"> => ({
  ref: "", nome: "", site: "", dominio: "", fundadores: "", descricao: "", pais: "", vertical: "", fase: "",
  etapa: "fit", etapaDesde: hoje(), interesse: "investimento", entrada: hoje(),
  vez: "sogrape", proximaAcao: "", prazo: null, responsavel: "", passos: [],
  ronda: { valuation: null, valor: null, ticket: null, lead: "", coinvestidores: [], notas: "" },
  origem: { tipo: "candidatura", nome: "Candidatura", contacto: "" }, documentos: [], arquivo: null,
  criadoEm: nowIso(), atualizadoEm: nowIso(),
});

/** Próxima referência do ano (AAAA-nnn), a seguir à maior que existe. */
export function proximaRef(deals: Deal[]) {
  const ano = hoje().slice(0, 4);
  const max = Math.max(0, ...deals.map((d) => Number((d.ref || "").match(/^\d{4}-(\d+)/)?.[1] || 0)));
  return `${ano}-${String(max + 1).padStart(3, "0")}`;
}

export async function addInteracao(dealId: string, i: Omit<Interacao, "id">) {
  await addDoc(collection(db, "deals", dealId, "interacoes"), clean({ ...i, criadoEm: nowIso() }));
}
export const delInteracao = (dealId: string, id: string) => deleteDoc(doc(db, "deals", dealId, "interacoes", id));
export const updInteracao = (dealId: string, id: string, p: Partial<Interacao>) => updateDoc(doc(db, "deals", dealId, "interacoes", id), clean(p));

export async function createDeal(d: Omit<Deal, "id">, by: string, nota = "") {
  const id = `df-${d.ref || slug(d.nome)}`;
  await setDoc(ref(id), clean({ ...d, criadoEm: nowIso(), atualizadoEm: nowIso(), criadoPor: by }));
  await addInteracao(id, { data: hoje(), tipo: "etapa", texto: `Entrou no pipeline em ${nomeEtapa(d.etapa)}.${nota ? ` ${nota}` : ""}`, por: by });
  return id;
}

export const saveDeal = (d: Deal, p: Partial<Deal>) => updateDoc(ref(d.id), clean({ ...p, atualizadoEm: nowIso() }));

/* ---------- Próximos passos ---------- */

export const novoPasso = (p: Partial<Passo> = {}): Passo => ({ id: Math.random().toString(36).slice(2, 10), texto: "", vez: "sogrape", prazo: null, responsavel: "", feito: null, ...p });
/** Os passos de uma startup; as fichas antigas, só com um próximo passo, passam a ter um passo na lista. */
export function passosDe(d: Pick<Deal, "passos" | "proximaAcao" | "vez" | "prazo" | "responsavel">): Passo[] {
  if (Array.isArray(d.passos)) return d.passos;
  return d.proximaAcao || d.prazo ? [{ id: "p0", texto: d.proximaAcao || "", vez: d.vez, prazo: d.prazo || null, responsavel: d.responsavel || "", feito: null }] : [];
}
/** Primeiro os que têm prazo mais próximo; os sem prazo ficam no fim. */
export const ordemPassos = (a: Passo, b: Passo) => (a.prazo || "9999").localeCompare(b.prazo || "9999");
export const passosAbertos = (d: Pick<Deal, "passos" | "proximaAcao" | "vez" | "prazo" | "responsavel">) => passosDe(d).filter((p) => !p.feito).sort(ordemPassos);
/** Guarda a lista e copia o passo em aberto mais urgente para os campos que o quadro, a lista e o CSV usam. */
export const resumoPassos = (passos: Passo[]) => {
  const p = passos.filter((x) => !x.feito).sort(ordemPassos)[0];
  return { passos, vez: p ? p.vez : null, proximaAcao: p?.texto || "", prazo: p?.prazo || null, responsavel: p?.responsavel || "" };
};
export async function savePassos(d: Deal, passos: Passo[], by?: string, log?: string) {
  await saveDeal(d, resumoPassos(passos));
  if (log && by) await addInteracao(d.id, { data: hoje(), tipo: "nota", texto: log, por: by });
}

export async function moveDeal(d: Deal, etapa: Etapa, by: string) {
  if (d.etapa === etapa) return;
  // Ao sair para o radar ou para as investidas, guarda a fase em curso de onde saiu (para reabrir e para o funil)
  const saida = !emCurso(etapa) ? { etapaAnterior: emCurso(d.etapa) ? d.etapa : d.etapaAnterior || d.arquivo?.etapaAnterior || null } : { etapaAnterior: null };
  await updateDoc(ref(d.id), { etapa, etapaDesde: hoje(), arquivo: null, ...saida, atualizadoEm: nowIso() });
  await addInteracao(d.id, { data: hoje(), tipo: "etapa", texto: `${nomeEtapa(d.etapa)} → ${nomeEtapa(etapa)}`, por: by });
}

export async function archiveDeal(d: Deal, motivo: MotivoArquivo, nota: string, by: string) {
  await updateDoc(ref(d.id), clean({ etapa: "arquivada", etapaDesde: hoje(), vez: null, proximaAcao: "", prazo: null, atualizadoEm: nowIso(),
    arquivo: { motivo, nota, em: hoje(), etapaAnterior: emCurso(d.etapa) ? d.etapa : d.etapaAnterior || d.arquivo?.etapaAnterior || null } }));
  const m = MOTIVOS_ARQUIVO.find((x) => x.id === motivo)?.nome;
  await addInteracao(d.id, { data: hoje(), tipo: "etapa", texto: `Arquivada: ${m}${nota ? `. ${nota}` : ""}`, por: by });
}

export async function reopenDeal(d: Deal, by: string) {
  const etapa = (d.arquivo?.etapaAnterior || d.etapaAnterior || "fit") as Etapa;
  const r = resumoPassos(passosDe(d));
  await updateDoc(ref(d.id), clean({ etapa, etapaDesde: hoje(), arquivo: null, etapaAnterior: null, ...r, vez: r.vez || "sogrape", atualizadoEm: nowIso() }));
  await addInteracao(d.id, { data: hoje(), tipo: "etapa", texto: `Reaberta em ${nomeEtapa(etapa)}`, por: by });
}

/** Leva uma startup do radar para o pipeline (fica ligada à ficha e à análise). */
export function dealFromStartup(s: Startup, deals: Deal[], setor: string): Omit<Deal, "id"> {
  return {
    ...DEAL_VAZIO(), ref: proximaRef(deals), nome: s.nome, site: s.site, dominio: s.dominio, descricao: s.descricao, ...(s.cadeia ? { cadeia: s.cadeia } : {}), ...(s.setor ? { categoria: s.setor } : {}),
    pais: s.pais || "", etapa: "fit", interesse: "investimento", vez: "sogrape", proximaAcao: "Fazer o primeiro contacto", passos: [novoPasso({ texto: "Fazer o primeiro contacto" })],
    origem: { tipo: "radar", nome: setor ? `Radar · ${setor}` : "Radar de startups", contacto: "" },
    startupId: s.id, ...(s.analiseResumo ? { analiseResumo: s.analiseResumo } : {}),
  };
}

/**
 * Tira uma startup do pipeline e põe-na nas Aprovadas: o deal é apagado (com a cronologia e as análises do deal)
 * e a ficha no radar de startups fica aprovada e sem ligação ao pipeline. Sem ficha, cria uma com os dados do deal.
 */
export async function dealParaAprovadas(d: Deal, by: string) {
  const sid = d.startupId || (d.dominio ? d.dominio.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : `xl-${slug(d.nome)}`);
  const sref = doc(db, "startups", sid);
  const ex = await getDoc(sref);
  if (ex.exists()) {
    const s = ex.data() as Startup;
    await updateDoc(sref, { status: "approved", dealId: deleteField(), pipelineEm: deleteField(), motivoRejeicao: deleteField(),
      ...(s.status !== "approved" ? { aprovadoEm: nowIso(), aprovadoPor: by } : {}), atualizadoEm: nowIso() });
  } else {
    const fase = ({ ideia: "ideia", "pre-seed": "seed", seed: "seed", "serie-a": "serie-a", "scale-up": "crescimento", crescimento: "crescimento" } as Record<string, Startup["fase"]>)[d.fase] || "seed";
    await setDoc(sref, clean({
      status: "approved", nome: d.nome, site: d.site || "", dominio: d.dominio || "", pais: d.pais || "", fundacao: null, fase, setor: d.categoria || "",
      ...(d.cadeia ? { cadeia: d.cadeia } : {}), ...(d.logo ? { logo: d.logo } : {}), descricao: d.descricao || "", porque: "", relevancia: 50, financiamento: "", investidores: [],
      origens: [{ tipo: "manual", titulo: `Pipeline · ${d.origem?.nome || "Sogrape Ventures"}`, url: d.site || "", data: (d.entrada || hoje()).slice(0, 10) }], destaque: false,
      ...(d.analiseResumo ? { analiseResumo: d.analiseResumo } : {}),
      criadoEm: nowIso(), atualizadoEm: nowIso(), manual: true, criadoPor: by, aprovadoEm: nowIso(), aprovadoPor: by,
    }));
  }
  for (const sub of ["interacoes", "analises"]) {
    const l = await getDocs(collection(db, "deals", d.id, sub));
    await Promise.all(l.docs.map((x) => deleteDoc(x.ref)));
  }
  await deleteDoc(ref(d.id));
}

/** Procura no pipeline uma startup do radar: pela ficha ligada, pelo domínio ou pelo nome. */
export function findDeal(deals: Deal[], s: Pick<Startup, "id" | "dominio" | "nome">): Deal | undefined {
  const n = normNome(s.nome);
  return deals.find((d) => d.startupId === s.id) || deals.find((d) => !!s.dominio && d.dominio === s.dominio) || deals.find((d) => !!n && normNome(d.nome) === n);
}

/* ---------- Exportação para Excel (CSV com ; e BOM, abre direto no Excel em português) ---------- */

const nome = <T extends { id: string; nome: string }>(l: T[], id: string | null | undefined) => l.find((x) => x.id === id)?.nome || "";
export function dealsCsv(deals: Deal[]) {
  const head = ["Ref", "Entrada", "Startup", "Site", "Fundadores", "Descrição", "País", "Cadeia de valor", "Fase", "Etapa", "Desde", "De quem é a vez", "Próxima ação", "Prazo", "Responsável", "Outros passos em aberto",
    "Valuation (€)", "Ronda (€)", "Ticket (€)", "Lead", "Coinvestidores", "Notas da ronda", "Origem", "Origem (nome)", "Contacto", "Motivo de arquivo", "Nota de arquivo", "Análise", "Ticket sugerido"];
  const esc = (v: unknown) => { const t = v == null ? "" : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = deals.map((d) => [d.ref, d.entrada, d.nome, d.site, d.fundadores, d.descricao, d.pais, (AREAS_LISTA.find((a) => a.id === d.cadeia)?.nome || ""), nome(FASES_DF, d.fase), nomeEtapa(d.etapa), d.etapaDesde,
    nome(VEZES, d.vez), d.proximaAcao, d.prazo, d.responsavel, passosAbertos(d).slice(1).map((p) => `${p.texto}${p.prazo ? ` (${p.prazo})` : ""}`).join(" | "), d.ronda?.valuation, d.ronda?.valor, d.ronda?.ticket, d.ronda?.lead, (d.ronda?.coinvestidores || []).join(", "), d.ronda?.notas,
    nome(ORIGENS_DF, d.origem?.tipo), d.origem?.nome, d.origem?.contacto, nome(MOTIVOS_ARQUIVO, d.arquivo?.motivo), d.arquivo?.nota,
    d.analiseResumo ? nomeDecisao(d.analiseResumo.decisao) : "", d.analiseResumo?.ticket || ""]);
  return "﻿" + [head, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}
