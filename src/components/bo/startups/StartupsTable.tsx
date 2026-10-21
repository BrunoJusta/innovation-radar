"use client";
import { Fragment, useMemo, useState } from "react";
import { Pager, usePaged } from "@/components/Pager";
import { Icon } from "@/components/Icon";
import { FASES, Sector, Startup, nomeDecisao } from "@/lib/types";
import { fdCurto, relLevel } from "@/lib/util";
import { Gauge } from "../ui";
import { SREJECT } from "./StartupDrawer";
import { Logo } from "./Logo";
import { nomeTicket } from "@/lib/analise-util";
import { AnaliseLoading, useAnaliseQueue } from "../AnaliseQueue";

type Col = "nome" | "setor" | "fase" | "pais" | "fundacao" | "relevancia" | "criadoEm" | "analise";
const FASE_ORD: Record<string, number> = { ideia: 0, seed: 1, "serie-a": 2, crescimento: 3 };

/** Vista em lista: colunas ordenáveis, seleção múltipla e ações por linha. */
export function StartupsTable({ list, sectors, onOpen, onAnalise, onApprove, onReject, onBack, onDelete, onBulk, pageKey = "" }: {
  /** Muda quando os filtros mudam: volta à 1.ª página. */
  pageKey?: string;
  list: Startup[]; sectors: Sector[]; onOpen: (id: string) => void; onAnalise: (s: Startup) => void;
  onApprove: (s: Startup) => void; onReject: (s: Startup, motivo: string) => void; onBack: (s: Startup) => void; onDelete: (s: Startup) => void;
  onBulk: (ids: string[], acao: "approve" | "reject" | "back" | "delete", motivo?: string) => Promise<void>;
}) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "relevancia", dir: -1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rejectRow, setRejectRow] = useState<string | null>(null);
  const [bulkReject, setBulkReject] = useState(false);
  const sec = (id: string) => sectors.find((x) => x.id === id);
  const { running } = useAnaliseQueue();

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
        case "analise": return s.analiseResumo ? (s.analiseResumo.decisao === "investir" ? 100 : s.analiseResumo.decisao === "incerto" ? 50 : 0) + s.analiseResumo.positivos : -1;
      }
    };
    return [...list].sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || b.relevancia - a.relevancia; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, sort, sectors]);

  // 40 por página; a seleção pode juntar linhas de várias páginas
  const pg = usePaged(rows, `${sort.col}${sort.dir}|${pageKey}`);
  const visible = new Set(rows.map((r) => r.id));
  const sel = [...picked].filter((id) => visible.has(id));
  const all = pg.items.length > 0 && pg.items.every((r) => picked.has(r.id));
  const status = rows[0]?.status;
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };
  // Função (não componente): o botão de ordenar não é recriado e mantém o foco
  const Th = ({ col, children, cls = "" }: { col: Col; children: React.ReactNode; cls?: string }) => (
    <th key={col} className={cls} aria-sort={sort.col === col ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="thb" onClick={() => setSort(sort.col === col ? { col, dir: sort.dir === 1 ? -1 : 1 } : { col, dir: col === "relevancia" || col === "criadoEm" || col === "fundacao" || col === "analise" ? -1 : 1 })}>
        {children}<Icon name={sort.col === col ? (sort.dir === 1 ? "caret-up" : "caret-down") : "caret-up-down"} /></button>
    </th>
  );
  const bulk = async (acao: "approve" | "reject" | "back" | "delete", motivo?: string) => { await onBulk(sel, acao, motivo); setPicked(new Set()); setBulkReject(false); };

  return (<>
    <div ref={pg.top} className="pgr-anchor" />
    <div className="tbl stbl">
      <table>
        <thead><tr>
          <th className="ck"><input type="checkbox" aria-label="Selecionar todas" checked={all} onChange={() => { const n = new Set(picked); pg.items.forEach((r) => (all ? n.delete(r.id) : n.add(r.id))); setPicked(n); }} /></th>
          {Th({ col: "nome", children: "Startup" })}{Th({ col: "setor", children: "Categoria" })}{Th({ col: "fase", children: "Fase" })}{Th({ col: "pais", children: "País" })}
          {Th({ col: "fundacao", cls: "n", children: "Fundação" })}<th>Financiamento</th>{Th({ col: "analise", children: "Análise" })}{Th({ col: "relevancia", cls: "n", children: "Relevância" })}{Th({ col: "criadoEm", cls: "n", children: "Entrou" })}
          <th className="acts"><span className="sr">Ações</span></th>
        </tr></thead>
        <tbody>{pg.items.map((s) => {
          const c = sec(s.setor), f = FASES.find((x) => x.id === s.fase);
          return (<Fragment key={s.id}>
            <tr className={picked.has(s.id) ? "on" : ""} tabIndex={0} onClick={() => onOpen(s.id)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(s.id); }} style={{ ["--c" as string]: c?.cor || "var(--ink-tertiary)" }}>
              <td className="ck" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${s.nome}`} checked={picked.has(s.id)} onChange={() => toggle(s.id)} /></td>
              <td><div className="tname"><Logo nome={s.nome} logo={s.logo} />
                <div><b>{s.nome}</b><a href={s.site} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{s.dominio}</a></div></div></td>
              <td><span className="tg ar">{c?.nome || "Sem categoria"}</span></td>
              <td>{f?.nome}</td>
              <td>{s.pais || <span className="mut">Sem dados</span>}</td>
              <td className="n">{s.fundacao || <span className="mut">-</span>}</td>
              <td className="fin">{s.financiamento || <span className="mut">Sem dados</span>}</td>
              <td>{running.has(`startups/${s.id}`) ? <AnaliseLoading path={`startups/${s.id}`} /> : <button type="button" className={`anchip btn-an ${s.analiseResumo ? s.analiseResumo.decisao : "none"}`} onClick={(e) => { e.stopPropagation(); onAnalise(s); }}
                title={s.analiseResumo ? `Análise de investimento: ${nomeDecisao(s.analiseResumo.decisao).toLowerCase()}${s.analiseResumo.ticket ? `, ${nomeTicket(s.analiseResumo.ticket)}` : ""}, ${s.analiseResumo.positivos} de 11 critérios positivos` : "Fazer a análise de investimento"}>
                <Icon name="scales" />{s.analiseResumo ? "Ver análise" : "Fazer análise"}</button>}</td>
              <td className="n"><span className={`trel lv-${relLevel(s.relevancia)}`}><Gauge v={s.relevancia} />{s.relevancia}</span></td>
              <td className="n mut">{fdCurto(s.criadoEm)}</td>
              <td className="acts" onClick={(e) => e.stopPropagation()}>
                {s.status === "pending" ? (<>
                  <button className="btn icon" title="Aprovar" aria-label={`Aprovar ${s.nome}`} onClick={() => onApprove(s)}><Icon name="check" /></button>
                  <button className="btn icon" title="Arquivar" aria-label={`Arquivar ${s.nome}`} aria-expanded={rejectRow === s.id} onClick={() => setRejectRow(rejectRow === s.id ? null : s.id)}><Icon name="prohibit" /></button>
                  <button className="btn icon" title="Eliminar" aria-label={`Eliminar ${s.nome}`} onClick={() => onDelete(s)}><Icon name="trash" /></button>
                </>) : (<>
                  <button className="btn icon" title="Voltar à triagem" aria-label={`Voltar à triagem ${s.nome}`} onClick={() => onBack(s)}><Icon name="arrow-u-up-left" /></button>
                  {s.status === "rejected" && <button className="btn icon" title="Eliminar" aria-label={`Eliminar ${s.nome}`} onClick={() => onDelete(s)}><Icon name="trash" /></button>}
                </>)}
              </td>
            </tr>
            {rejectRow === s.id && (
              <tr className="rrow"><td colSpan={11}>
                <span>Porque arquivas «{s.nome}»?</span>
                {SREJECT.map((m) => <button key={m} className="chipf" onClick={() => { setRejectRow(null); onReject(s, m); }}>{m}</button>)}
                <button className="txtbtn" onClick={() => setRejectRow(null)}>Cancelar</button>
              </td></tr>
            )}
          </Fragment>);
        })}</tbody>
      </table>
    </div>
    <Pager {...pg} label="startups" />
    {sel.length > 0 && (
      <div className="bulk">
        <span>{sel.length} selecionada{sel.length > 1 ? "s" : ""}</span>
        {bulkReject ? (<>
          {SREJECT.map((m) => <button key={m} className="btn" onClick={() => bulk("reject", m)}>{m}</button>)}
          <button className="txtbtn" onClick={() => setBulkReject(false)}>Cancelar</button>
        </>) : status === "pending" ? (<>
          <button className="btn primary" onClick={() => bulk("approve")}><Icon name="check" />Aprovar</button>
          <button className="btn" onClick={() => setBulkReject(true)}><Icon name="prohibit" />Arquivar</button>
          <button className="btn" onClick={() => bulk("delete")}><Icon name="trash" />Eliminar</button>
        </>) : (<>
          <button className="btn" onClick={() => bulk("back")}><Icon name="arrow-u-up-left" />Voltar à triagem</button>
          {status === "rejected" && <button className="btn" onClick={() => bulk("delete")}><Icon name="trash" />Eliminar</button>}
        </>)}
        <button className="btn icon" title="Limpar seleção" aria-label="Limpar seleção" onClick={() => { setPicked(new Set()); setBulkReject(false); }}><Icon name="x" /></button>
      </div>
    )}
  </>);
}
