"use client";
import { forwardRef, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { marks } from "@/lib/search";
import { fdCurto } from "@/lib/util";

/** Texto com as palavras da pesquisa marcadas. */
export function Hl({ text, ts }: { text: string; ts: string[] }) {
  return <>{marks(text, ts).map((p, i) => (p.m ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}</>;
}

/** Data curta; junta o ano quando não é o ano corrente. */
export const dCurta = (iso: string) => {
  const y = new Date(iso).getFullYear();
  return `${fdCurto(iso)}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
};

const F_MES = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });
export const mesKey = (iso: string) => iso.slice(0, 7);
export const mesLabel = (iso: string) => { const t = F_MES.format(new Date(iso)); return t.charAt(0).toUpperCase() + t.slice(1); };

/** Caixa de pesquisa. O texto de exemplo vai mudando enquanto está vazia. */
export const SearchBox = forwardRef<HTMLInputElement, {
  q: string; setQ: (q: string) => void; examples: string[]; suggestions: { label: string; icon?: string; color?: string }[];
  onKey: (e: React.KeyboardEvent<HTMLInputElement>) => void; busy: boolean; activeId?: string;
  /** Mostra o atalho de teclado (só onde o atalho existe). */
  kbd?: boolean; placeholder?: string;
}>(function SearchBox({ q, setQ, examples, suggestions, onKey, busy, activeId, kbd = true, placeholder = "Pesquisar sinais" }, ref) {
  const [ex, setEx] = useState(0);
  const [focus, setFocus] = useState(false);
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);
  useEffect(() => {
    if (q || focus || examples.length < 2) return;
    const t = setInterval(() => setEx((n) => (n + 1) % examples.length), 2800);
    return () => clearInterval(t);
  }, [q, focus, examples.length]);
  const showSug = focus && !q && suggestions.length > 0;

  return (
    <div className={`sbox${q ? " has" : ""}${focus ? " foc" : ""}`}>
      <span className="sic" aria-hidden="true"><Icon name="magnifying-glass" size={18} />{busy && <i className="spin" />}</span>
      <input ref={ref} type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
        onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 120)}
        placeholder={placeholder} aria-label="Pesquisar notícias" autoComplete="off" spellCheck={false}
        role="combobox" aria-expanded={!!q} aria-controls="sres" aria-activedescendant={activeId ? `sr-${activeId}` : undefined} />
      {/* Exemplo animado por cima da caixa vazia (o placeholder real fica para os leitores de ecrã) */}
      {!q && examples.length > 0 && (
        <span className="sph" aria-hidden="true">
          <span>Pesquisar</span> <b key={ex}>{examples[ex % examples.length]}</b>
        </span>
      )}
      {q ? (
        <button className="sclr" aria-label="Limpar pesquisa" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ("")}><Icon name="x" size={14} /></button>
      ) : (
        kbd && <kbd className="skbd" aria-hidden="true">{mac ? "⌘K" : "/"}</kbd>
      )}
      {showSug && (
        <div className="ssug" role="listbox" aria-label="Pesquisas sugeridas">
          <span className="ssl">Experimenta</span>
          <div className="ssc">
            {suggestions.map((s) => (
              <button key={s.label} role="option" aria-selected={false} className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ(s.label)}>
                {s.icon ? <Icon name={s.icon} /> : s.color ? <span className="cdot" style={{ background: s.color }} /> : null}{s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export function ViewToggle({ view, setView }: { view: "radar" | "lista"; setView: (v: "radar" | "lista") => void }) {
  return (
    <div className="vtog" role="radiogroup" aria-label="Vista">
      <span className="vth" style={{ transform: view === "lista" ? "translateX(100%)" : "none" }} aria-hidden="true" />
      <button role="radio" title="Radar" aria-checked={view === "radar"} onClick={() => setView("radar")}><Icon name="target" />Radar</button>
      <button role="radio" title="Lista" aria-checked={view === "lista"} onClick={() => setView("lista")}><Icon name="list-bullets" />Lista</button>
    </div>
  );
}
