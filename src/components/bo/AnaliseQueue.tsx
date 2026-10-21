"use client";
import { nomeDecisao } from "@/lib/types";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlvoAnalise, runAnalise } from "@/lib/analise-run";
import { useSession } from "./AuthGate";

type Q = { queue: (a: AlvoAnalise) => void; running: Set<string>; atual: string | null };
const Ctx = createContext<Q>({ queue: () => {}, running: new Set(), atual: null });
export const useAnaliseQueue = () => useContext(Ctx);

/** Análises de investimento em segundo plano (uma de cada vez), para quem adiciona startups não ter de esperar. */
export function AnaliseQueueProvider({ notify, children }: { notify: (m: string) => void; children: React.ReactNode }) {
  const { email } = useSession();
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [atual, setAtual] = useState<string | null>(null);
  const fila = useRef<AlvoAnalise[]>([]);
  const ativo = useRef(false);

  const next = useCallback(async () => {
    if (ativo.current) return;
    const alvo = fila.current.shift();
    if (!alvo) return;
    ativo.current = true;
    setAtual(alvo.path);
    try {
      const r = await runAnalise(alvo, email);
      notify(`Análise de investimento de «${alvo.nome}» pronta: ${nomeDecisao(r.analise.decisao).toLowerCase()}`);
    } catch (e) {
      notify(`A análise de «${alvo.nome}» falhou (${(e as Error).message.slice(0, 80)}). Podes refazê-la na ficha.`);
    } finally {
      ativo.current = false;
      setAtual(null);
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

  return <Ctx.Provider value={{ queue, running, atual }}>{children}</Ctx.Provider>;
}

/** Etiqueta de análise a correr ou em fila, para tabelas e cartões. */
export function AnaliseLoading({ path, short }: { path: string; short?: boolean }) {
  const { running, atual } = useAnaliseQueue();
  if (!running.has(path)) return null;
  const agora = atual === path;
  return <span className={`anchip run${agora ? "" : " wait"}`} role="status" title={agora ? "Análise de investimento a correr" : "Na fila para a análise de investimento"}>
    <span className="spin" aria-hidden="true" />{agora ? (short ? "A analisar" : "A analisar…") : "Na fila"}</span>;
}
