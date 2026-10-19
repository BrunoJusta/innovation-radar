"use client";
import "./Pager.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export const PAGE_SIZE = 40;

/**
 * Paginação de uma lista já filtrada e ordenada. Volta à 1.ª página quando `resetKey` muda
 * (filtros, pesquisa, ordem) e nunca fica numa página que já não existe (por exemplo, depois
 * de aprovar as últimas notícias da página).
 */
export function usePaged<T>(items: T[], resetKey = "", size = PAGE_SIZE) {
  const [page, setPageS] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const pages = Math.max(1, Math.ceil(items.length / size));
  useEffect(() => setPageS(0), [resetKey]);
  const cur = Math.min(page, pages - 1);
  const pageItems = useMemo(() => items.slice(cur * size, cur * size + size), [items, cur, size]);
  const setPage = (p: number) => {
    setPageS(Math.max(0, Math.min(pages - 1, p)));
    // Leva a vista ao início da lista (só se o início já tiver saído do ecrã)
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  return { page: cur, setPage, pages, items: pageItems, total: items.length, from: cur * size, size, top };
}

/** Números das páginas a mostrar: primeira, última e as vizinhas da atual, com reticências pelo meio. */
function nums(page: number, pages: number): (number | "…")[] {
  const set = new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages));
  const l = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  l.forEach((p, i) => { if (i && p - l[i - 1] > 1) out.push(p - l[i - 1] === 2 ? p - 1 : "…"); out.push(p); });
  return out;
}

export function Pager({ page, pages, setPage, total, from, size, label = "itens", className = "" }: {
  page: number; pages: number; setPage: (p: number) => void; total: number; from: number; size: number; label?: string; className?: string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className={`pgr ${className}`} aria-label="Paginação">
      <span className="pgi">{from + 1}–{Math.min(total, from + size)} de {total} {label}</span>
      <div className="pgb">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Página anterior"><Icon name="caret-left" /></button>
        {nums(page, pages).map((n, i) => n === "…"
          ? <span key={`e${i}`} className="pge" aria-hidden="true">…</span>
          : <button type="button" key={n} onClick={() => setPage(n)} aria-current={n === page ? "page" : undefined} aria-label={`Página ${n + 1}`}>{n + 1}</button>)}
        <button type="button" onClick={() => setPage(page + 1)} disabled={page === pages - 1} aria-label="Página seguinte"><Icon name="caret-right" /></button>
      </div>
    </nav>
  );
}
