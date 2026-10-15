"use client";
import { Icon } from "@/components/Icon";
import { relLabel, relLevel } from "@/lib/util";

/** Velocímetro de relevância: verde alta, amarelo média, vermelho baixa. */
export function Gauge({ v, lg = false }: { v: number; lg?: boolean }) {
  const P = (x: number) => { const t = Math.PI * (1 - x / 100); return [50 + 40 * Math.cos(t), 50 - 40 * Math.sin(t)]; };
  const arc = (a: number, b: number) => { const [p, q] = P(a), [r, u] = P(b); return `M${p.toFixed(2)} ${q.toFixed(2)} A40 40 0 0 1 ${r.toFixed(2)} ${u.toFixed(2)}`; };
  const lv = relLevel(v);
  const seg: [number, number, string, string][] = [[0, 64.5, "var(--g-low)", "baixa"], [65.5, 84.5, "var(--g-mid)", "media"], [85.5, 100, "var(--g-ok)", "alta"]];
  const t = Math.PI * (1 - v / 100), nx = 50 + 30 * Math.cos(t), ny = 50 - 30 * Math.sin(t);
  return (
    <div className={`gauge ${lg ? "lg" : "sm"}`} title={`Relevância ${v}/100, ${relLabel(v).toLowerCase()}`} role="img" aria-label={`Relevância ${v} de 100, ${relLabel(v).toLowerCase()}`}>
      <svg viewBox="0 0 100 56" aria-hidden="true" style={{ marginBottom: -2 }}>
        {seg.map((g) => <path key={g[3]} d={arc(g[0], g[1])} fill="none" stroke={g[2]} strokeWidth={lg ? 9 : 15} opacity={g[3] === lv ? 1 : lg ? 0.22 : 0.3} />)}
        <line x1="50" y1="50" x2={nx.toFixed(2)} y2={ny.toFixed(2)} stroke="var(--ink)" strokeWidth={lg ? 3 : 7} strokeLinecap="round" />
        <circle cx="50" cy="50" r={lg ? 5 : 9} fill="var(--ink)" />
      </svg>
      {lg && <span className={`gv lv-${lv}`}>{v}</span>}
    </div>
  );
}

export function Empty({ icon, title, text, children }: { icon?: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="ic">{icon}</div>}
      <h2>{title}</h2><p>{text}</p>{children}
    </div>
  );
}

/** Pesquisa dentro da página (filtra só a lista que está à vista). */
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="fsearch"><Icon name="magnifying-glass" />
      <input type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && value) { e.stopPropagation(); onChange(""); } }} />
      {value && <button type="button" className="fsx" aria-label="Limpar pesquisa" onClick={() => onChange("")}><Icon name="x" /></button>}
    </label>
  );
}
