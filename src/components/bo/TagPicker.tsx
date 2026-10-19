"use client";
import { Icon } from "@/components/Icon";
import { Category, TIPOS_TAG, tipoDe } from "@/lib/types";

/** Tags de uma notícia em três grupos (temáticas, tecnologias e canais): várias por grupo, pelo menos uma temática. */
export function TagPicker({ cats, value, onChange }: { cats: Category[]; value: string[]; onChange: (tags: string[]) => void }) {
  const semTematica = !value.some((id) => cats.some((c) => c.id === id && tipoDe(c) === "tematica"));
  return (
    <div className="tagpick">
      {TIPOS_TAG.map((t) => {
        const l = cats.filter((c) => tipoDe(c) === t.id).sort((a, b) => a.ordem - b.ordem);
        if (!l.length) return null;
        return (
          <div className="tpg" key={t.id} role="group" aria-label={t.plural}>
            <span className="tpl">{t.plural}{t.id === "tematica" ? <em>pelo menos uma</em> : <em>opcional</em>}</span>
            <div className="tpc">{l.map((c) => {
              const on = value.includes(c.id);
              return <button type="button" key={c.id} className="tpchip" aria-pressed={on} title={c.descricao}
                onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])}><Icon name={c.icone} />{c.nome}</button>;
            })}</div>
          </div>
        );
      })}
      {semTematica && <p className="tpw" role="alert"><Icon name="warning-circle" />Escolhe pelo menos uma temática.</p>}
    </div>
  );
}

/** Há pelo menos uma temática nas tags? */
export const temTematica = (tags: string[], cats: Category[]) => tags.some((id) => cats.some((c) => c.id === id && tipoDe(c) === "tematica"));
