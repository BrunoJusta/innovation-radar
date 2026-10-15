"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Deal, ETAPAS, Etapa, Interacao, MotivoArquivo, MOTIVOS_ARQUIVO, ORIGENS_DF, Startup, VERTICAIS_DF, FASES_DF, VEZES } from "./types";
import { hojeLocal, nowIso, slug } from "./util";

const ref = (id: string) => doc(db, "deals", id);
const hoje = () => hojeLocal();
const clean = (o: Record<string, any>) => JSON.parse(JSON.stringify(o));
export const nomeEtapa = (e: string) => ETAPAS.find((x) => x.id === e)?.nome || e;
export const normNome = (s: string) => slug(s.replace(/\(.*?\)/g, "")).replace(/-/g, "");

export const DEAL_VAZIO = (): Omit<Deal, "id"> => ({
  ref: "", nome: "", site: "", dominio: "", fundadores: "", descricao: "", pais: "", vertical: "", fase: "",
  etapa: "contacto", etapaDesde: hoje(), interesse: "investimento", entrada: hoje(),
  vez: "sogrape", proximaAcao: "", prazo: null, responsavel: "",
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

export async function moveDeal(d: Deal, etapa: Etapa, by: string) {
  if (d.etapa === etapa) return;
  await updateDoc(ref(d.id), { etapa, etapaDesde: hoje(), arquivo: null, atualizadoEm: nowIso() });
  await addInteracao(d.id, { data: hoje(), tipo: "etapa", texto: `${nomeEtapa(d.etapa)} → ${nomeEtapa(etapa)}`, por: by });
}

export async function archiveDeal(d: Deal, motivo: MotivoArquivo, nota: string, by: string) {
  await updateDoc(ref(d.id), clean({ etapa: "arquivada", etapaDesde: hoje(), vez: null, proximaAcao: "", prazo: null, atualizadoEm: nowIso(),
    arquivo: { motivo, nota, em: hoje(), etapaAnterior: d.etapa === "arquivada" ? d.arquivo?.etapaAnterior || null : d.etapa } }));
  const m = MOTIVOS_ARQUIVO.find((x) => x.id === motivo)?.nome;
  await addInteracao(d.id, { data: hoje(), tipo: "etapa", texto: `Arquivada: ${m}${nota ? `. ${nota}` : ""}`, por: by });
}

export async function reopenDeal(d: Deal, by: string) {
  const etapa = (d.arquivo?.etapaAnterior || "contacto") as Etapa;
  await updateDoc(ref(d.id), { etapa, etapaDesde: hoje(), arquivo: null, vez: "sogrape", atualizadoEm: nowIso() });
  await addInteracao(d.id, { data: hoje(), tipo: "etapa", texto: `Reaberta em ${nomeEtapa(etapa)}`, por: by });
}

/** Leva uma startup do radar para o pipeline (fica ligada à ficha e à análise). */
export function dealFromStartup(s: Startup, deals: Deal[], setor: string): Omit<Deal, "id"> {
  return {
    ...DEAL_VAZIO(), ref: proximaRef(deals), nome: s.nome, site: s.site, dominio: s.dominio, descricao: s.descricao,
    pais: s.pais || "", etapa: "radar", interesse: "investimento", vez: "sogrape", proximaAcao: "Fazer o primeiro contacto",
    origem: { tipo: "radar", nome: setor ? `Radar · ${setor}` : "Radar de startups", contacto: "" },
    startupId: s.id, ...(s.analiseResumo ? { analiseResumo: s.analiseResumo } : {}),
  };
}

/** Procura no pipeline uma startup do radar: pela ficha ligada, pelo domínio ou pelo nome. */
export function findDeal(deals: Deal[], s: Pick<Startup, "id" | "dominio" | "nome">): Deal | undefined {
  const n = normNome(s.nome);
  return deals.find((d) => d.startupId === s.id) || deals.find((d) => !!s.dominio && d.dominio === s.dominio) || deals.find((d) => !!n && normNome(d.nome) === n);
}

/* ---------- Exportação para Excel (CSV com ; e BOM, abre direto no Excel em português) ---------- */

const nome = <T extends { id: string; nome: string }>(l: T[], id: string | null | undefined) => l.find((x) => x.id === id)?.nome || "";
export function dealsCsv(deals: Deal[]) {
  const head = ["Ref", "Entrada", "Startup", "Site", "Fundadores", "Descrição", "País", "Vertical", "Fase", "Etapa", "Desde", "De quem é a vez", "Próxima ação", "Prazo", "Responsável",
    "Valuation (€)", "Ronda (€)", "Ticket (€)", "Lead", "Coinvestidores", "Notas da ronda", "Origem", "Origem (nome)", "Contacto", "Motivo de arquivo", "Nota de arquivo", "Análise", "Ticket sugerido"];
  const esc = (v: unknown) => { const t = v == null ? "" : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = deals.map((d) => [d.ref, d.entrada, d.nome, d.site, d.fundadores, d.descricao, d.pais, nome(VERTICAIS_DF, d.vertical), nome(FASES_DF, d.fase), nomeEtapa(d.etapa), d.etapaDesde,
    nome(VEZES, d.vez), d.proximaAcao, d.prazo, d.responsavel, d.ronda?.valuation, d.ronda?.valor, d.ronda?.ticket, d.ronda?.lead, (d.ronda?.coinvestidores || []).join(", "), d.ronda?.notas,
    nome(ORIGENS_DF, d.origem?.tipo), d.origem?.nome, d.origem?.contacto, nome(MOTIVOS_ARQUIVO, d.arquivo?.motivo), d.arquivo?.nota,
    d.analiseResumo ? (d.analiseResumo.decisao === "investir" ? "Investir" : "Não investir") : "", d.analiseResumo?.ticket || ""]);
  return "﻿" + [head, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}
