"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { Achado, Loc, pesquisar } from "@/lib/localizacao";
import type { Deal, Startup } from "@/lib/types";
import type { Evento, Projeto } from "@/lib/inovacao";
import { normDeal } from "./pipeline/DealsLookup";
import { useSession } from "./AuthGate";

type Dados = { startups: Startup[]; deals: Deal[]; projetos: Projeto[]; eventos: Evento[] };
const ICONE = { startup: "lightbulb", projeto: "target", evento: "calendar-blank" } as const;
const TIPO = { startup: "Startup", projeto: "Projeto", evento: "Evento" } as const;

/** Lê uma coleção uma vez; sem permissão (ex.: o pipeline para editores) fica vazia. */
const ler = async <T,>(col: string, map: (d: T) => T = (d) => d): Promise<T[]> => {
  try { return (await getDocs(collection(db, col))).docs.map((d) => map({ ...d.data(), id: d.id } as T)); } catch { return []; }
};

/**
 * Pesquisa global (na barra de cima): procura em startups, projetos e eventos e mostra onde cada um está
 * (por exemplo «Pipeline › Arquivo» ou «Triagem › Arquivo»). Ao escolher, abre essa página filtrada pelo nome e com o item aberto.
 * Atalho: ⌘K ou Ctrl+K.
 */
export function GlobalSearch({ onGo }: { onGo: (l: Loc) => void }) {
  const { canPipeline } = useSession();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const lidoEm = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  // Carrega na primeira vez que se abre e volta a carregar se os dados tiverem mais de 30 segundos
  const carregar = async () => {
    if (loading || Date.now() - lidoEm.current < 30_000) return;
    setLoading(true);
    const [startups, deals, projetos, eventos] = await Promise.all([
      ler<Startup>("startups"), canPipeline ? ler<Deal>("deals", normDeal) : Promise.resolve([] as Deal[]), ler<Projeto>("projects"), ler<Evento>("events"),
    ]);
    setDados({ startups, deals, projetos, eventos }); lidoEm.current = Date.now(); setLoading(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); input.current?.select(); } };
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, []);

  const res: Achado[] = useMemo(() => (dados ? pesquisar(q, { ...dados, pipeline: canPipeline }) : []), [q, dados, canPipeline]);
  useEffect(() => setSel(0), [q]);

  const ir = (a: Achado) => { setOpen(false); setQ(""); input.current?.blur(); onGo(a.loc); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { if (q) setQ(""); else { setOpen(false); input.current?.blur(); } e.stopPropagation(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(res.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter" && res[sel]) { e.preventDefault(); ir(res[sel]); }
  };
  const mostrar = open && q.trim().length >= 2;

  return (
    <div className="gs" ref={box}>
      <label className={`searchbox${q ? " has" : ""}`} title="Pesquisar startups, projetos e eventos (⌘K)">
        <Icon name="magnifying-glass" />
        <input ref={input} type="search" value={q} placeholder="Pesquisar startups, projetos, eventos" aria-label="Pesquisar startups, projetos e eventos"
          role="combobox" aria-expanded={mostrar} aria-controls="gs-list" aria-autocomplete="list" autoComplete="off" spellCheck={false}
          aria-activedescendant={mostrar && res[sel] ? `gs-${sel}` : undefined}
          onFocus={() => { setOpen(true); carregar(); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey} />
        <kbd className="gs-k" aria-hidden="true">⌘K</kbd>
      </label>
      {mostrar && (
        <div className="gs-pop" role="listbox" id="gs-list" aria-label="Resultados">
          {!dados ? <p className="gs-msg"><span className="spin" aria-hidden="true" />A carregar…</p>
            : !res.length ? <p className="gs-msg">Nada encontrado para «{q.trim()}».</p>
            : res.map((a, i) => (
              <button key={`${a.tipo}-${a.id}`} id={`gs-${i}`} role="option" aria-selected={i === sel} className="gs-it"
                onMouseEnter={() => setSel(i)} onClick={() => ir(a)}>
                <span className={`gs-ic t-${a.tipo}`} title={TIPO[a.tipo]}><Icon name={ICONE[a.tipo]} /></span>
                <span className="gs-tx"><b>{a.nome}</b>{a.sub && <small>{a.sub}</small>}</span>
                <span className="gs-onde" aria-label={`Está em ${a.onde.join(", ")}`}>
                  {a.onde.map((o, k) => <span key={k}>{k > 0 && <Icon name="caret-right" />}{o}</span>)}</span>
              </button>
            ))}
          {dados && loading && <p className="gs-msg sm">A atualizar…</p>}
        </div>
      )}
    </div>
  );
}
