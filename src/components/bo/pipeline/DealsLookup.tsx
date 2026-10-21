"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { findDeal } from "@/lib/deal-actions";
import { Deal, Startup, etapaAtual } from "@/lib/types";
import { useSession } from "../AuthGate";

type L = { deals: Deal[]; dealOf: (s: Pick<Startup, "id" | "dominio" | "nome">) => Deal | undefined; on: boolean; loaded: boolean; erro: string };
const Ctx = createContext<L>({ deals: [], dealOf: () => undefined, on: false, loaded: false, erro: "" });
export const useDeals = () => useContext(Ctx);

/** Fichas gravadas com as fases antigas passam a ler-se com as atuais (a migração no seed grava a mudança). */
export const normDeal = (d: Deal): Deal => ({ ...d, etapa: etapaAtual(d.etapa), ...(d.arquivo ? { arquivo: { ...d.arquivo, etapaAnterior: d.arquivo.etapaAnterior ? etapaAtual(d.arquivo.etapaAnterior) : null } } : {}) });

/** Para as startups do radar saberem se já estão (ou estiveram) no pipeline. Só para quem tem acesso. */
export function DealsLookup({ children }: { children: React.ReactNode }) {
  const { canPipeline } = useSession();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => canPipeline ? onSnapshot(collection(db, "deals"), (s) => { setDeals(s.docs.map((d) => normDeal({ id: d.id, ...d.data() } as Deal))); setLoaded(true); setErro(""); },
    (e) => { setDeals([]); setLoaded(true); setErro((e as { code?: string }).code === "permission-denied" ? "O pipeline é só para administradores. Se és admin, publica as regras do Firestore atualizadas." : "Não foi possível carregar o pipeline."); }) : undefined, [canPipeline]);
  const v = useMemo(() => ({ deals, dealOf: (s: Pick<Startup, "id" | "dominio" | "nome">) => findDeal(deals, s), on: canPipeline, loaded, erro }), [deals, canPipeline, loaded, erro]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
