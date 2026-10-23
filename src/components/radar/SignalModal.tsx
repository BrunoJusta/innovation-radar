"use client";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { Area, Category } from "@/lib/types";
import { fdLongo } from "@/lib/util";
import type { RadarItem } from "./RadarApp";

function splitParagraphs(resumo: string) {
  // A Gemini devolve parágrafos separados por linha em branco: o primeiro é o lead
  const blocks = resumo.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
  if (blocks.length > 1) return { lede: blocks[0], paras: blocks.slice(1) };
  const sent = resumo.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g) || [resumo];
  let lede = sent[0].trim(), i = 1;
  while (lede.length < 90 && i < sent.length) { lede += " " + sent[i].trim(); i++; }
  const rest = sent.slice(i).map((t) => t.trim()).filter(Boolean);
  const paras: string[] = [];
  for (let k = 0; k < rest.length; k += 2) paras.push(rest.slice(k, k + 2).join(" "));
  return { lede, paras };
}

export function SignalModal({ item: x, items, areas, R, area, cat, tags, onClose }: {
  item: RadarItem; items: RadarItem[]; areas: Area[]; R: number[]; area?: Area; cat?: Category; /** Todas as tags da notícia (sem isto mostra só `cat`). */ tags?: Category[]; onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const { lede, paras } = splitParagraphs(x.resumo);
  const minutos = Math.max(1, Math.round(x.resumo.split(/\s+/).length / 200));
  const c = area?.cor || "#7C3AED";
  const S = 0.2;

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <article className="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
        <button className="mclose" ref={closeRef} aria-label="Fechar" onClick={onClose}><Icon name="x" /></button>
        <header className="mhead" style={{ ["--c" as string]: c }}>
          <div className="mtop">
            <div className="mtl">
              <div className="kick"><span className="a">{area?.nome}</span>{(tags || (cat ? [cat] : [])).map((c) => <span key={c.id} className="ttag">{c.nome}</span>)}</div>
              <h2 className="mtitle" id="mt">{x.titulo}</h2>
              <div className="mdate">{fdLongo(x.data)}<span className="dot" />{minutos} min de leitura</div>
            </div>
            <div className="mini" aria-hidden="true">
              <svg viewBox="-64 -64 128 128">
                {areas.map((a, i) => ({ a, i })).reverse().map(({ a, i }) => (
                  <circle key={a.id} r={(R[i] * S).toFixed(1)} fill="none" stroke={a.cor} strokeWidth={1.5} opacity={a.id === x.area ? 1 : 0.35} />
                ))}
                {items.map((y) => (
                  <circle key={y.id} cx={(y.x * S).toFixed(1)} cy={(y.y * S).toFixed(1)} r={y.id === x.id ? 4.5 : 2.2}
                    fill={y.id === x.id ? c : "var(--ink-tertiary)"} opacity={y.id === x.id ? 1 : 0.5} />
                ))}
                <circle className="mping" cx={(x.x * S).toFixed(1)} cy={(x.y * S).toFixed(1)} r={4.5} fill="none" stroke={c} strokeWidth={1.5} />
              </svg>
              <span>Sinal {String(x.n).padStart(2, "0")}</span>
            </div>
          </div>
        </header>
        <div className="mbody">
          <div className="txt"><p className="lede">{lede}</p>{paras.map((t, i) => <p key={i}>{t}</p>)}</div>
        </div>
        <section className="msrc">
          <h4>Fontes</h4>
          <ul className="srcl">
            {x.fontes.map((f) => (
              <li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer"><span>{f.titulo}</span><Icon name="arrow-up-right" /></a></li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}
