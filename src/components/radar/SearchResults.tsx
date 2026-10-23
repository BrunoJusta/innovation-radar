"use client";
import { Icon } from "@/components/Icon";
import { useEffect, useRef } from "react";
import { snippet, SearchHit } from "@/lib/search";
import { Area, Category } from "@/lib/types";
import type { RadarItem } from "./RadarApp";
import { dCurta, Hl } from "./SearchBits";

export type EmLabels = Record<SearchHit["em"][number], string>;
const EM_LABEL: EmLabels = {
  titulo: "título", resumo: "resumo", entidades: "entidades", area: "área", categoria: "categoria", fontes: "fontes",
};

/** Onde foi encontrada (sem repetir as entidades, que já aparecem marcadas). */
export const where = (h: SearchHit, labels: EmLabels = EM_LABEL, entidades = true) => h.em.filter((f) => f !== "entidades" || (entidades && !h.entidades.length)).map((f) => labels[f]).join(", ");

/** Resumo da pesquisa: quantos, em que áreas (barra clicável) e entidades relacionadas para afinar. */
export function SearchSummary({ q, n, total, byArea, areas, fRing, setFRing, cat, clearCat, related, setQ, compact = false, noun = ["sinal", "sinais"] }: {
  q: string; n: number; total: number; byArea: Record<string, number>; areas: Area[];
  fRing: string | null; setFRing: (id: string | null) => void; cat?: Category; clearCat: () => void;
  related: string[]; setQ: (q: string) => void; compact?: boolean;
  /** Nome do que se procura, no singular e no plural. */
  noun?: [string, string];
}) {
  const sum = Object.values(byArea).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className={`ssum${compact ? " compact" : ""}`} aria-live="polite">
      <div className="ssn">
        <b key={`${q}|${n}`}>{n}</b>
        <span>{n === 1 ? noun[0] : noun[1]} para <q>{q.trim()}</q>{total > n && <em> · {total} sem os filtros</em>}</span>
      </div>
      {total > 0 && (
        <>
          <div className="sbar" role="group" aria-label="Resultados por área">
            {areas.filter((a) => byArea[a.id]).map((a) => (
              <button key={a.id} style={{ ["--c" as string]: a.cor, flexGrow: byArea[a.id] / sum }} aria-pressed={fRing === a.id}
                className={fRing && fRing !== a.id ? "off" : ""} onClick={() => setFRing(fRing === a.id ? null : a.id)}
                title={`${a.nome}: ${byArea[a.id]}`} aria-label={`${a.nome}, ${byArea[a.id]}`} />
            ))}
          </div>
          <div className="sbl">
            {areas.filter((a) => byArea[a.id]).map((a) => (
              <button key={a.id} style={{ ["--c" as string]: a.cor }} aria-pressed={fRing === a.id} className={fRing && fRing !== a.id ? "off" : ""}
                onClick={() => setFRing(fRing === a.id ? null : a.id)}>
                <i />{a.nome}<span>{byArea[a.id]}</span>
              </button>
            ))}
            {cat && <button className="fcat" onClick={clearCat} aria-label={`Tirar filtro ${cat.nome}`}><Icon name={cat.icone} />{cat.nome}<Icon name="x" /></button>}
          </div>
        </>
      )}
      {related.length > 0 && (
        <div className="srel">
          <span>Relacionado</span>
          {related.map((e) => <button key={e} className="chip" onClick={() => setQ(e)}>{e}</button>)}
        </div>
      )}
    </div>
  );
}

/** Lista de resultados ao lado do radar. Passar o rato acende o ponto correspondente. */
export function SearchResults({ results, hitsById, ts, area, cat, active, setHover, onOpen, empty, labels, entidades = true }: {
  results: RadarItem[]; hitsById: Map<string, SearchHit>; ts: string[];
  area: (id: string) => Area | undefined; cat: (id: string) => Category | undefined;
  active: number; setHover: (id: string | null) => void; onOpen: (id: string) => void; empty: React.ReactNode;
  labels?: EmLabels; /** Mostrar as entidades (no radar público nunca aparecem). */ entidades?: boolean;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const first = results[0]?.id;
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [first]);
  if (!results.length) return <div className="snone">{empty}</div>;
  return (
    <ol className="slist" id="sres" role="listbox" aria-label="Resultados da pesquisa" ref={ref}>
      {results.map((x, k) => {
        const a = area(x.area), h = hitsById.get(x.id);
        return (
          <li key={x.id} style={{ ["--k" as string]: Math.min(k, 12), ["--c" as string]: x.color }}>
            <button id={`sr-${x.id}`} role="option" aria-selected={k === active} className={`sitem${k === active ? " act" : ""}`}
              onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(x.id)} onBlur={() => setHover(null)}
              onClick={() => onOpen(x.id)}>
              <span className="num">{x.n}</span>
              <span className="sbody">
                <span className="smeta"><b>{a?.nome}</b><span className="sd">{dCurta(x.data)}</span></span>
                <span className="stit"><Hl text={x.titulo} ts={ts} /></span>
                <span className="ssn2"><Hl text={snippet(x.resumo, ts, 150)} ts={ts} /></span>
                {(x.tags || [x.cat]).length > 0 && <span className="ttags">{(x.tags || [x.cat]).map(cat).filter((y): y is Category => !!y).slice(0, 3).map((t) => <span key={t.id} className="ttag">{t.nome}</span>)}</span>}
                {h && (
                  <span className="sem">
                    {entidades && h.entidades.slice(0, 3).map((e) => <span key={e} className="sent"><Hl text={e} ts={ts} /></span>)}
                    {where(h, labels, entidades) && <span className="swhere">em {where(h, labels, entidades)}</span>}
                  </span>
                )}
              </span>
              <Icon name="arrow-up-right" className="sgo" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
