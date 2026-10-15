"use client";
import { Fragment, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Area, Category, REJECT_REASONS, Signal } from "@/lib/types";
import { fdCurto, relLevel } from "@/lib/util";
import { Gauge } from "./ui";

type Col = "titulo" | "area" | "categoria" | "dataPublicacao" | "relevancia" | "criadoEm";

/** Vista em lista das notícias: colunas ordenáveis, seleção múltipla e ações por linha. */
export function SignalsTable({ list, areas, cats, onOpen, onApprove, onReject, onBack, onBulk }: {
  list: Signal[]; areas: Area[]; cats: Category[]; onOpen: (id: string) => void;
  onApprove: (s: Signal) => void; onReject: (s: Signal, motivo: string) => void; onBack: (s: Signal) => void;
  onBulk: (ids: string[], acao: "approve" | "reject" | "back", motivo?: string) => Promise<void>;
}) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "relevancia", dir: -1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rejectRow, setRejectRow] = useState<string | null>(null);
  const [bulkReject, setBulkReject] = useState(false);
  const area = (id: string) => areas.find((a) => a.id === id);
  const cat = (id: string) => cats.find((c) => c.id === id);

  const rows = useMemo(() => {
    const v = (s: Signal): string | number => {
      switch (sort.col) {
        case "titulo": return s.titulo.toLowerCase();
        case "area": return area(s.area)?.ordem ?? 99;
        case "categoria": return cat(s.categoria)?.ordem ?? 99;
        case "dataPublicacao": return s.dataPublicacao;
        case "relevancia": return s.relevancia;
        case "criadoEm": return s.criadoEm;
      }
    };
    return [...list].sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || b.relevancia - a.relevancia; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, sort, areas, cats]);

  const visible = new Set(rows.map((r) => r.id));
  const sel = [...picked].filter((id) => visible.has(id));
  const all = rows.length > 0 && sel.length === rows.length;
  const status = rows[0]?.status;
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };
  const Th = ({ col, children, cls = "" }: { col: Col; children: React.ReactNode; cls?: string }) => (
    <th className={cls} aria-sort={sort.col === col ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="thb" onClick={() => setSort(sort.col === col ? { col, dir: sort.dir === 1 ? -1 : 1 } : { col, dir: col === "titulo" || col === "area" || col === "categoria" ? 1 : -1 })}>
        {children}<Icon name={sort.col === col ? (sort.dir === 1 ? "caret-up" : "caret-down") : "caret-up-down"} /></button>
    </th>
  );
  const bulk = async (acao: "approve" | "reject" | "back", motivo?: string) => { await onBulk(sel, acao, motivo); setPicked(new Set()); setBulkReject(false); };

  return (<>
    <div className="tbl stbl ntbl">
      <table>
        <thead><tr>
          <th className="ck"><input type="checkbox" aria-label="Selecionar todas" checked={all} onChange={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
          <Th col="titulo">Notícia</Th><Th col="area">Área</Th><Th col="categoria">Categoria</Th>
          <Th col="dataPublicacao" cls="n">Publicada</Th><Th col="relevancia" cls="n">Relevância</Th><Th col="criadoEm" cls="n">Entrou</Th>
          <th className="acts"><span className="sr">Ações</span></th>
        </tr></thead>
        <tbody>{rows.map((s) => {
          const a = area(s.area), c = cat(s.categoria), sites = [...new Set(s.fontes.map((f) => f.site))];
          return (<Fragment key={s.id}>
            <tr className={picked.has(s.id) ? "on" : ""} onClick={() => onOpen(s.id)} style={{ ["--c" as string]: a?.cor || "var(--ink-tertiary)" }}>
              <td className="ck" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${s.titulo}`} checked={picked.has(s.id)} onChange={() => toggle(s.id)} /></td>
              <td className="ttl"><b>{s.titulo}</b>
                <span className="tsub">{sites.length > 1 ? `${sites[0]} e mais ${sites.length - 1}` : sites[0]}
                  {s.flagNovaFonte && s.status === "pending" && <em className="tnew">Nova fonte</em>}{s.manual && <em className="tman">À mão</em>}</span></td>
              <td><span className="tg ar">{a?.nome || "Sem área"}</span></td>
              <td><span className="tcat">{c && <Icon name={c.icone} />}{c?.nome}</span></td>
              <td className="n mut">{fdCurto(s.dataPublicacao)}</td>
              <td className="n"><span className={`trel lv-${relLevel(s.relevancia)}`}><Gauge v={s.relevancia} />{s.relevancia}</span></td>
              <td className="n mut">{fdCurto(s.criadoEm)}</td>
              <td className="acts" onClick={(e) => e.stopPropagation()}>
                {s.status === "pending" ? (<>
                  <button className="btn icon" title="Aprovar" aria-label="Aprovar" onClick={() => onApprove(s)}><Icon name="check" /></button>
                  <button className="btn icon" title="Rejeitar" aria-label="Rejeitar" aria-expanded={rejectRow === s.id} onClick={() => setRejectRow(rejectRow === s.id ? null : s.id)}><Icon name="x" /></button>
                </>) : (
                  <button className="btn icon" title="Voltar à triagem" aria-label="Voltar à triagem" onClick={() => onBack(s)}><Icon name="arrow-u-up-left" /></button>
                )}
              </td>
            </tr>
            {rejectRow === s.id && (
              <tr className="rrow"><td colSpan={8}>
                <span>Porque rejeitas esta notícia?</span>
                {REJECT_REASONS.map((m) => <button key={m} className="chipf" onClick={() => { setRejectRow(null); onReject(s, m); }}>{m}</button>)}
                <button className="txtbtn" onClick={() => setRejectRow(null)}>Cancelar</button>
              </td></tr>
            )}
          </Fragment>);
        })}</tbody>
      </table>
    </div>
    {sel.length > 0 && (
      <div className="bulk">
        <span>{sel.length} selecionada{sel.length > 1 ? "s" : ""}</span>
        {bulkReject ? (<>
          {REJECT_REASONS.map((m) => <button key={m} className="btn" onClick={() => bulk("reject", m)}>{m}</button>)}
          <button className="txtbtn" onClick={() => setBulkReject(false)}>Cancelar</button>
        </>) : status === "pending" ? (<>
          <button className="btn primary" onClick={() => bulk("approve")}><Icon name="check" />Aprovar</button>
          <button className="btn" onClick={() => setBulkReject(true)}><Icon name="x" />Rejeitar</button>
        </>) : (
          <button className="btn" onClick={() => bulk("back")}><Icon name="arrow-u-up-left" />Voltar à triagem</button>
        )}
        <button className="btn icon" title="Limpar seleção" aria-label="Limpar seleção" onClick={() => { setPicked(new Set()); setBulkReject(false); }}><Icon name="x" /></button>
      </div>
    )}
  </>);
}
