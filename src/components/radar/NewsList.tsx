"use client";
import { CatSelect } from "@/components/CatSelect";
import { Icon } from "@/components/Icon";
import { snippet, SearchHit } from "@/lib/search";
import { Area, Category } from "@/lib/types";
import type { RadarItem } from "./RadarApp";
import { dCurta, Hl, mesKey, mesLabel } from "./SearchBits";
import { where } from "./SearchResults";

export type Ordem = "recentes" | "relevancia";

/** Vista em lista: todas as notícias do período (ou da pesquisa), por mês ou por relevância. */
export function NewsList({ rows, allRows, pager, topRef, ts, searching, hitsById, areas, cats, fRing, setFRing, fCat, setFCat, counts, catCount, catTotal, period, setPeriod, periodOptions,
  ordem, setOrdem, active, onOpen, setHover, summary, empty }: {
  /** Notícias desta página; `allRows` são todas (para os totais). */
  rows: RadarItem[]; allRows: RadarItem[]; pager: React.ReactNode; topRef: React.RefObject<HTMLDivElement | null>; ts: string[]; searching: boolean; hitsById: Map<string, SearchHit>;
  areas: Area[]; cats: Category[]; fRing: string | null; setFRing: (id: string | null) => void; fCat: string; setFCat: (id: string) => void;
  counts: (aid: string) => number; catCount: (cid: string) => number; catTotal?: number; period: string; setPeriod: (p: string) => void; periodOptions: { v: string; l: string }[];
  ordem: Ordem; setOrdem: (o: Ordem) => void; active: number; onOpen: (id: string) => void; setHover: (id: string | null) => void;
  summary: React.ReactNode; empty: React.ReactNode;
}) {
  const area = (id: string) => areas.find((a) => a.id === id);
  const cat = (id: string) => cats.find((c) => c.id === id);

  // Grupos por mês quando a ordem é cronológica; numa pesquisa ordenada por relevância fica uma lista só
  const groups: { key: string; label: string; rows: RadarItem[] }[] = [];
  if (ordem === "recentes") {
    for (const x of rows) {
      const k = mesKey(x.data);
      const g = groups[groups.length - 1];
      if (g && g.key === k) g.rows.push(x); else groups.push({ key: k, label: mesLabel(x.data), rows: [x] });
    }
  } else groups.push({ key: "all", label: "", rows });

  // Total de cada mês em todas as páginas (um mês pode continuar na página seguinte)
  const mesTotal = (k: string) => allRows.filter((x) => mesKey(x.data) === k).length;

  let idx = -1;
  return (
    <div className="lv">
      {searching ? summary : (
        <div className="lbar">
          <div className="lareas" role="group" aria-label="Filtrar por cadeia de valor">
            <button className="chip" aria-pressed={!fRing} onClick={() => setFRing(null)}>Todas as cadeias de valor</button>
            {areas.map((a) => (
              <button key={a.id} className="chip achip" style={{ ["--c" as string]: a.cor }} aria-pressed={fRing === a.id} onClick={() => setFRing(fRing === a.id ? null : a.id)}>
                <span className="cdot" />{a.nome}<span className="cn">{counts(a.id)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="lctl">
        <span className="lcount"><b>{allRows.length}</b> {allRows.length === 1 ? "notícia" : "notícias"}</span>
        {!searching && <CatSelect cats={cats} value={fCat} onChange={setFCat} counts={catCount} total={catTotal} />}
        <span className="sp" />
        {!searching && (
          <label className="periodo">
            <span>Período</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período">
              {periodOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </label>
        )}
        <label className="periodo">
          <span>Ordenar</span>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
            <option value="recentes">Mais recentes</option>
            <option value="relevancia">{searching ? "Melhor correspondência" : "Mais relevantes"}</option>
          </select>
        </label>
      </div>
      <div ref={topRef} className="pgr-anchor" />
      {!rows.length ? <div className="snone">{empty}</div> : (
        <div className="lgroups" id="sres" role={searching ? "listbox" : undefined} aria-label={searching ? "Resultados da pesquisa" : undefined}>
          {groups.map((g) => (
            <section key={g.key} className="lgrp" aria-label={g.label || undefined}>
              {g.label && <h3 className="lmh"><span>{g.label}</span><em>{mesTotal(g.key)}</em></h3>}
              <ol className="lrows">
                {g.rows.map((x) => {
                  idx++;
                  const a = area(x.area), tg = (x.tags || [x.cat]).map(cat).filter((y): y is Category => !!y), h = hitsById.get(x.id), k = idx;
                  return (
                    <li key={x.id} style={{ ["--c" as string]: x.color, ["--k" as string]: Math.min(k, 14) }}>
                      <button id={`sr-${x.id}`} className={`lrow${k === active ? " act" : ""}`} onClick={() => onOpen(x.id)}
                        role={searching ? "option" : undefined} aria-selected={searching ? k === active : undefined}
                        onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover(null)}>
                        <span className="num">{x.n}</span>
                        <span className="lmain">
                          <span className="ltit"><Hl text={x.titulo} ts={ts} />{x.destaque && <span className="lstar" title="Destaque"><Icon name="star-fill" /></span>}</span>
                          <span className="lres"><Hl text={searching ? snippet(x.resumo, ts, 220) : x.resumo} ts={ts} /></span>
                          <span className="lmeta">
                            <span className="lar"><i />{a?.nome}</span>
                            {tg.slice(0, 3).map((c) => <span key={c.id} className="lca"><Icon name={c.icone} />{c.nome}</span>)}
                            {x.entidades.slice(0, 4).map((e) => <span key={e} className="lent"><Hl text={e} ts={ts} /></span>)}
                            {searching && h && where(h) && <span className="swhere">encontrado em {where(h)}</span>}
                          </span>
                        </span>
                        <span className="ldate">{dCurta(x.data)}<small>{x.fontes.length} {x.fontes.length === 1 ? "fonte" : "fontes"}</small></span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {pager}
        </div>
      )}
    </div>
  );
}
