"use client";
import { Fragment, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { FASES, Sector, Startup } from "@/lib/types";
import { fdCurto, relLevel } from "@/lib/util";
import { Gauge } from "../ui";
import { SREJECT } from "./StartupDrawer";

type Col = "nome" | "setor" | "fase" | "pais" | "fundacao" | "relevancia" | "criadoEm";
const FASE_ORD: Record<string, number> = { ideia: 0, seed: 1, "serie-a": 2, crescimento: 3 };

/** Vista em lista: colunas ordenáveis, seleção múltipla e ações por linha. */
export function StartupsTable({ list, sectors, onOpen, onApprove, onReject, onStar, onBack, onBulk }: {
  list: Startup[]; sectors: Sector[]; onOpen: (id: string) => void;
  onApprove: (s: Startup) => void; onReject: (s: Startup, motivo: string) => void; onStar: (s: Startup) => void; onBack: (s: Startup) => void;
  onBulk: (ids: string[], acao: "approve" | "reject" | "back", motivo?: string) => Promise<void>;
}) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "relevancia", dir: -1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rejectRow, setRejectRow] = useState<string | null>(null);
  const [bulkReject, setBulkReject] = useState(false);
  const sec = (id: string) => sectors.find((x) => x.id === id);

  const rows = useMemo(() => {
    const v = (s: Startup): string | number => {
      switch (sort.col) {
        case "nome": return s.nome.toLowerCase();
        case "setor": return sec(s.setor)?.ordem ?? 99;
        case "fase": return FASE_ORD[s.fase] ?? -1;
        case "pais": return (s.pais || "zzz").toLowerCase();
        case "fundacao": return s.fundacao ?? 0;
        case "relevancia": return s.relevancia;
        case "criadoEm": return s.criadoEm;
      }
    };
    return [...list].sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || b.relevancia - a.relevancia; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, sort, sectors]);

  const visible = new Set(rows.map((r) => r.id));
  const sel = [...picked].filter((id) => visible.has(id));
  const all = rows.length > 0 && sel.length === rows.length;
  const status = rows[0]?.status;
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };
  const Th = ({ col, children, cls = "" }: { col: Col; children: React.ReactNode; cls?: string }) => (
    <th className={cls} aria-sort={sort.col === col ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="thb" onClick={() => setSort(sort.col === col ? { col, dir: sort.dir === 1 ? -1 : 1 } : { col, dir: col === "relevancia" || col === "criadoEm" || col === "fundacao" ? -1 : 1 })}>
        {children}<Icon name={sort.col === col ? (sort.dir === 1 ? "caret-up" : "caret-down") : "caret-up-down"} /></button>
    </th>
  );
  const bulk = async (acao: "approve" | "reject" | "back", motivo?: string) => { await onBulk(sel, acao, motivo); setPicked(new Set()); setBulkReject(false); };

  return (<>
    <div className="tbl stbl">
      <table>
        <thead><tr>
          <th className="ck"><input type="checkbox" aria-label="Selecionar todas" checked={all} onChange={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
          <Th col="nome">Startup</Th><Th col="setor">Setor</Th><Th col="fase">Fase</Th><Th col="pais">País</Th>
          <Th col="fundacao" cls="n">Fundação</Th><th>Financiamento</th><Th col="relevancia" cls="n">Relevância</Th><Th col="criadoEm" cls="n">Entrou</Th>
          <th className="acts"><span className="sr">Ações</span></th>
        </tr></thead>
        <tbody>{rows.map((s) => {
          const c = sec(s.setor), f = FASES.find((x) => x.id === s.fase);
          return (<Fragment key={s.id}>
            <tr className={picked.has(s.id) ? "on" : ""} onClick={() => onOpen(s.id)} style={{ ["--c" as string]: c?.cor || "var(--ink-tertiary)" }}>
              <td className="ck" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${s.nome}`} checked={picked.has(s.id)} onChange={() => toggle(s.id)} /></td>
              <td><div className="tname"><span className="slogo">{s.nome.slice(0, 1).toUpperCase()}</span>
                <div><b>{s.nome}{s.destaque && <Icon name="star-fill" className="tstar" />}</b><a href={s.site} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{s.dominio}</a></div></div></td>
              <td><span className="tg ar">{c?.nome || "Sem setor"}</span></td>
              <td>{f?.nome}</td>
              <td>{s.pais || <span className="mut">Sem dados</span>}</td>
              <td className="n">{s.fundacao || <span className="mut">-</span>}</td>
              <td className="fin">{s.financiamento || <span className="mut">Sem dados</span>}</td>
              <td className="n"><span className={`trel lv-${relLevel(s.relevancia)}`}><Gauge v={s.relevancia} />{s.relevancia}</span></td>
              <td className="n mut">{fdCurto(s.criadoEm)}</td>
              <td className="acts" onClick={(e) => e.stopPropagation()}>
                {s.status === "pending" ? (<>
                  <button className="btn icon" title="Aprovar" aria-label={`Aprovar ${s.nome}`} onClick={() => onApprove(s)}><Icon name="check" /></button>
                  <button className="btn icon" title="Rejeitar" aria-label={`Rejeitar ${s.nome}`} aria-expanded={rejectRow === s.id} onClick={() => setRejectRow(rejectRow === s.id ? null : s.id)}><Icon name="x" /></button>
                </>) : (
                  <button className="btn icon" title="Voltar à triagem" aria-label={`Voltar à triagem ${s.nome}`} onClick={() => onBack(s)}><Icon name="arrow-u-up-left" /></button>
                )}
                {s.status !== "rejected" && <button className="btn icon" aria-pressed={!!s.destaque} title="Destacar" aria-label={`Destacar ${s.nome}`} onClick={() => onStar(s)}><Icon name={s.destaque ? "star-fill" : "star"} /></button>}
              </td>
            </tr>
            {rejectRow === s.id && (
              <tr className="rrow"><td colSpan={10}>
                <span>Porque rejeitas «{s.nome}»?</span>
                {SREJECT.map((m) => <button key={m} className="chipf" onClick={() => { setRejectRow(null); onReject(s, m); }}>{m}</button>)}
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
          {SREJECT.map((m) => <button key={m} className="btn" onClick={() => bulk("reject", m)}>{m}</button>)}
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
