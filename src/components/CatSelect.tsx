"use client";
import "./CatSelect.css";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Area, Category } from "@/lib/types";

/**
 * Filtro de categoria em dropdown: agrupado por anel, com pesquisa, contagens e teclado.
 * Usado no radar público e nas listas de notícias do backoffice. Com `area`, mostra só as
 * categorias desse anel (as categorias sem anel aparecem sempre).
 */
export function CatSelect({ cats, areas, value, onChange, counts, area = null, allLabel = "Todas as categorias", className = "" }: {
  cats: Category[]; areas: Area[]; value: string; onChange: (id: string) => void;
  counts?: (catId: string) => number; area?: string | null; allLabel?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const uid = useId();

  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visiveis = useMemo(() => cats.filter((c) => !area || !c.area || c.area === area), [cats, area]);

  // Grupos por anel (pela ordem dos anéis); as categorias sem anel ficam num grupo no fim
  const groups = useMemo(() => {
    const f = fold(q.trim());
    const match = (c: Category) => !f || fold(c.nome).includes(f);
    const out: { key: string; nome: string; cor?: string; items: Category[] }[] = [];
    for (const a of areas) {
      const items = visiveis.filter((c) => c.area === a.id && match(c));
      if (items.length) out.push({ key: a.id, nome: a.nome, cor: a.cor, items });
    }
    const soltas = visiveis.filter((c) => (!c.area || !areas.some((a) => a.id === c.area)) && match(c));
    if (soltas.length) out.push({ key: "_", nome: out.length ? "Sem anel" : "", items: soltas });
    return out;
  }, [areas, visiveis, q]);
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

  const total = counts ? visiveis.reduce((n, c) => n + counts(c.id), 0) : null;
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
        <button type="button" className="cdx" aria-label="Tirar filtro de categoria" onClick={() => onChange("all")}><Icon name="x" /></button>
      )}
      {open && (
        <div className="cdp" onKeyDown={onKey}>
          {visiveis.length > 6 && (
            <div className="cds-q">
              <Icon name="magnifying-glass" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar categoria" aria-label="Procurar categoria"
                role="combobox" aria-expanded aria-controls={`${uid}l`} aria-activedescendant={flat[hi] ? `${uid}-${flat[hi]}` : undefined} />
            </div>
          )}
          <div className="cdo" role="listbox" id={`${uid}l`} ref={list} tabIndex={visiveis.length > 6 ? -1 : 0} aria-label="Categorias">
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
            {!groups.length && <div className="cde">Nenhuma categoria com «{q}»</div>}
          </div>
        </div>
      )}
    </div>
  );
}
