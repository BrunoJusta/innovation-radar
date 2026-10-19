"use client";
import "./CatSelect.css";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Area, Category, TIPOS_TAG, TipoTag, tipoDe } from "@/lib/types";

/**
 * Filtro de tags em dropdown: agrupado em temáticas, tecnologias e canais, com pesquisa, contagens e teclado.
 * Usado no radar público e nas listas de notícias do backoffice.
 */
export function CatSelect({ cats, value, onChange, counts, total = null, allLabel = "Todas as tags", className = "", tipo }: {
  /** Só as tags deste tipo (sem cabeçalhos de grupo). */ tipo?: TipoTag;
  cats: Category[]; areas?: Area[]; value: string; onChange: (id: string) => void;
  counts?: (catId: string) => number; /** Número de notícias sem filtro de tag (uma notícia pode ter várias tags). */ total?: number | null; allLabel?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const uid = useId();

  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visiveis = useMemo(() => (tipo ? cats.filter((c) => tipoDe(c) === tipo) : cats), [cats, tipo]);

  // Grupos por tipo: temáticas, tecnologias e canais
  const groups = useMemo(() => {
    const f = fold(q.trim());
    const match = (c: Category) => !f || fold(c.nome).includes(f);
    const out: { key: string; nome: string; cor?: string; items: Category[] }[] = [];
    for (const tp of TIPOS_TAG) {
      const items = visiveis.filter((c) => tipoDe(c) === tp.id && match(c)).sort((a, b) => a.ordem - b.ordem);
      if (items.length) out.push({ key: tp.id, nome: tipo ? "" : tp.plural, items });
    }
    return out;
  }, [visiveis, q]);
  const flat = useMemo(() => [...(q.trim() ? [] : ["all"]), ...groups.flatMap((g) => g.items.map((c) => c.id))], [groups, q]);

  const cur = cats.find((c) => c.id === value);
  const close = () => { setOpen(false); setQ(""); };
  const pick = (id: string) => { onChange(id); close(); };

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, flat.indexOf(value)));
    setTimeout(() => (input.current || list.current)?.focus(), 0);
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { if (open) setHi(0); }, [q, open]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(flat.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (flat[hi]) pick(flat[hi]); }
  };

  let i = q.trim() ? -1 : 0;

  return (
    <div className={`cds${open ? " open" : ""}${value !== "all" ? " on" : ""} ${className}`} ref={box}>
      <button type="button" className="cdt" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}l`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); } }}>
        {cur ? <Icon name={cur.icone} /> : <Icon name="funnel" />}
        <span className="cdl">{cur ? cur.nome : allLabel}</span>
        {cur && counts && <span className="cdn">{counts(cur.id)}</span>}
        <Icon name="caret-down" className="cdc" />
      </button>
      {value !== "all" && (
        <button type="button" className="cdx" aria-label="Tirar filtro de tag" onClick={() => onChange("all")}><Icon name="x" /></button>
      )}
      {open && (
        <div className="cdp" onKeyDown={onKey}>
          {visiveis.length > 6 && (
            <div className="cds-q">
              <Icon name="magnifying-glass" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar tag" aria-label="Procurar tag"
                role="combobox" aria-expanded aria-controls={`${uid}l`} aria-activedescendant={flat[hi] ? `${uid}-${flat[hi]}` : undefined} />
            </div>
          )}
          <div className="cdo" role="listbox" id={`${uid}l`} ref={list} tabIndex={visiveis.length > 6 ? -1 : 0} aria-label="Tags">
            {!q.trim() && (
              <button type="button" role="option" id={`${uid}-all`} data-i={0} aria-selected={value === "all"} className={`cdi${hi === 0 ? " hi" : ""}`}
                onMouseEnter={() => setHi(0)} onClick={() => pick("all")}>
                <Icon name="stack" /><span>{allLabel}</span>{total !== null && <em>{total}</em>}{value === "all" && <Icon name="check" className="cdk" />}
              </button>
            )}
            {groups.map((g) => (
              <div key={g.key} className="cdg" role="group" aria-label={g.nome || undefined}>
                {g.nome && <div className="cdh">{g.cor && <i style={{ background: g.cor }} />}{g.nome}</div>}
                {g.items.map((c) => {
                  const k = ++i, n = counts?.(c.id);
                  return (
                    <button type="button" role="option" key={c.id} id={`${uid}-${c.id}`} data-i={k} aria-selected={value === c.id}
                      className={`cdi${hi === k ? " hi" : ""}${n === 0 ? " zero" : ""}`} onMouseEnter={() => setHi(k)} onClick={() => pick(c.id)}>
                      <Icon name={c.icone} /><span>{c.nome}</span>{n !== undefined && <em>{n}</em>}{value === c.id && <Icon name="check" className="cdk" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {!groups.length && <div className="cde">Nenhuma tag com «{q}»</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Filtro de tags em três: temática, tecnologia e canal (combinam-se: a notícia tem de ter as três escolhidas). */
export type TagFiltro = Record<TipoTag, string>;
export const SEM_FILTRO: TagFiltro = { tematica: "all", tecnologia: "all", canal: "all" };
const TIPOS: TipoTag[] = ["tematica", "tecnologia", "canal"];
const TODAS: Record<TipoTag, string> = { tematica: "Todas as temáticas", tecnologia: "Todas as tecnologias", canal: "Todos os canais" };
export const passaTags = (tags: string[], f: TagFiltro, ignora?: TipoTag) => TIPOS.every((k) => k === ignora || f[k] === "all" || tags.includes(f[k]));
export const temFiltro = (f: TagFiltro) => TIPOS.some((k) => f[k] !== "all");
/** Tags escolhidas nos três filtros. */
export const escolhidas = (f: TagFiltro) => TIPOS.map((k) => f[k]).filter((x) => x !== "all");

export function TagFilters({ cats, value, onChange, counts }: {
  cats: Category[]; value: TagFiltro; onChange: (f: TagFiltro) => void;
  /** Quantas notícias têm esta tag, com os outros filtros aplicados (o próprio tipo não conta). */ counts?: (catId: string, tipo: TipoTag) => number;
}) {
  return <>{TIPOS.filter((k) => cats.some((c) => tipoDe(c) === k)).map((k) => (
    <CatSelect key={k} tipo={k} cats={cats} value={value[k]} onChange={(id) => onChange({ ...value, [k]: id })}
      counts={counts ? (id) => counts(id, k) : undefined} allLabel={TODAS[k]} />
  ))}</>;
}
