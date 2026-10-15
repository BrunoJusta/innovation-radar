"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { findDeal } from "@/lib/deal-actions";
import { Deal, Startup } from "@/lib/types";
import { useSession } from "../AuthGate";

type L = { deals: Deal[]; dealOf: (s: Pick<Startup, "id" | "dominio" | "nome">) => Deal | undefined; on: boolean };
const Ctx = createContext<L>({ deals: [], dealOf: () => undefined, on: false });
export const useDeals = () => useContext(Ctx);

/** Para as startups do radar saberem se já estão (ou estiveram) no pipeline. Só para quem tem acesso. */
export function DealsLookup({ children }: { children: React.ReactNode }) {
  const { canPipeline } = useSession();
  const [deals, setDeals] = useState<Deal[]>([]);
  useEffect(() => canPipeline ? onSnapshot(collection(db, "deals"), (s) => setDeals(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Deal)), () => setDeals([])) : undefined, [canPipeline]);
  const v = useMemo(() => ({ deals, dealOf: (s: Pick<Startup, "id" | "dominio" | "nome">) => findDeal(deals, s), on: canPipeline }), [deals, canPipeline]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
