"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlvoAnalise, runAnalise } from "@/lib/analise-run";
import { useSession } from "./AuthGate";

type Q = { queue: (a: AlvoAnalise) => void; running: Set<string> };
const Ctx = createContext<Q>({ queue: () => {}, running: new Set() });
export const useAnaliseQueue = () => useContext(Ctx);

/** Análises de investimento em segundo plano (uma de cada vez), para quem adiciona startups não ter de esperar. */
export function AnaliseQueueProvider({ notify, children }: { notify: (m: string) => void; children: React.ReactNode }) {
  const { email } = useSession();
  const [running, setRunning] = useState<Set<string>>(new Set());
  const fila = useRef<AlvoAnalise[]>([]);
  const ativo = useRef(false);

  const next = useCallback(async () => {
    if (ativo.current) return;
    const alvo = fila.current.shift();
    if (!alvo) return;
    ativo.current = true;
    try {
      const r = await runAnalise(alvo, email);
      notify(`Análise de investimento de «${alvo.nome}» pronta: ${r.analise.decisao === "investir" ? "investir" : "não investir"}`);
    } catch (e) {
      notify(`A análise de «${alvo.nome}» falhou (${(e as Error).message.slice(0, 80)}). Podes refazê-la na ficha.`);
    } finally {
      ativo.current = false;
      setRunning((s) => { const n = new Set(s); n.delete(alvo.path); return n; });
      next();
    }
  }, [email, notify]);

  const queue = useCallback((a: AlvoAnalise) => {
    if (fila.current.some((x) => x.path === a.path)) return;
    fila.current.push(a);
    setRunning((s) => new Set(s).add(a.path));
    next();
  }, [next]);

  return <Ctx.Provider value={{ queue, running }}>{children}</Ctx.Provider>;
}
