"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Deal, VEZES } from "@/lib/types";
import { fdCurto, hojeLocal } from "@/lib/util";
import { nomeEtapa } from "@/lib/deal-actions";
import { prazoEstado } from "./PipelineBoard";

const F_MES = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });
const F_DIA = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" });
const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const local = (s: string) => new Date(`${s}T12:00:00`);
const addDays = (s: string, n: number) => { const d = local(s); d.setDate(d.getDate() + n); return iso(d); };

function AgendaItem({ d, onOpen, showDate = true }: { d: Deal; onOpen: (id: string) => void; showDate?: boolean }) {
  const pz = prazoEstado(d), vez = VEZES.find((v) => v.id === d.vez);
  return (
    <li><button className="agi" onClick={() => onOpen(d.id)}>
      {showDate && <span className={`pz ${pz === "atrasado" ? "late" : pz === "breve" ? "soon" : ""}`}>{fdCurto(d.prazo!)}</span>}
      <span className="agt"><b>{d.nome}</b><span>{d.proximaAcao || "Sem próximo passo definido"}</span></span>
      <span className="agm">{vez && <span className={`vez v-${vez.id}`}>{vez.curto}</span>}<em>{nomeEtapa(d.etapa)}</em></span>
    </button></li>
  );
}

/**
 * Calendário dos próximos passos do pipeline (pelo prazo).
 * `compact` (telemóvel): pontos nos dias e a agenda por baixo; no computador mostra os nomes em cada dia.
 */
export function PipelineCalendar({ deals, onOpen, compact = false }: { deals: Deal[]; onOpen: (id: string) => void; compact?: boolean }) {
  const hoje = hojeLocal();
  const [mes, setMes] = useState(() => hoje.slice(0, 7));
  const [sel, setSel] = useState<string | null>(null);
  const ativas = useMemo(() => deals.filter((d) => d.etapa !== "arquivada"), [deals]);
  const comPrazo = useMemo(() => ativas.filter((d) => d.prazo).sort((a, b) => (a.prazo || "").localeCompare(b.prazo || "")), [ativas]);
  const semPrazo = ativas.length - comPrazo.length;
  const porDia = useMemo(() => {
    const m = new Map<string, Deal[]>();
    comPrazo.forEach((d) => m.set(d.prazo!, [...(m.get(d.prazo!) || []), d]));
    return m;
  }, [comPrazo]);

  // Grelha de 6 semanas, a começar à segunda-feira
  const first = local(`${mes}-01`);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const dias = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return iso(d); });
  const semanas = dias[35].slice(0, 7) !== mes ? dias.slice(0, 35) : dias;
  const mover = (n: number) => { const d = local(`${mes}-01`); d.setMonth(d.getMonth() + n); setMes(iso(d).slice(0, 7)); setSel(null); };

  const grupos = sel ? [{ t: F_DIA.format(local(sel)), l: porDia.get(sel) || [] }] : [
    { t: "Atrasados", l: comPrazo.filter((d) => d.prazo! < hoje) },
    { t: "Hoje", l: porDia.get(hoje) || [] },
    { t: "Próximos 7 dias", l: comPrazo.filter((d) => d.prazo! > hoje && d.prazo! <= addDays(hoje, 7)) },
    { t: "Mais tarde", l: comPrazo.filter((d) => d.prazo! > addDays(hoje, 7)) },
  ].filter((g) => g.l.length);

  return (
    <div className={`pcal${compact ? " compact" : ""}`}>
      <div className="pcal-h">
        <h3>{F_MES.format(first)}</h3>
        <span className="sp" />
        <button className="btn" onClick={() => { setMes(hoje.slice(0, 7)); setSel(hoje); }}>Hoje</button>
        <button className="btn icon" aria-label="Mês anterior" title="Mês anterior" onClick={() => mover(-1)}><Icon name="caret-left" /></button>
        <button className="btn icon" aria-label="Mês seguinte" title="Mês seguinte" onClick={() => mover(1)}><Icon name="caret-right" /></button>
      </div>
      <div className="pcal-g" role="grid" aria-label={`Prazos de ${F_MES.format(first)}`}>
        <div className="pcal-wd" role="row">{DIAS.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
        {Array.from({ length: semanas.length / 7 }, (_, w) => (
          <div key={w} className="pcal-w" role="row">
            {semanas.slice(w * 7, w * 7 + 7).map((d) => {
              const l = porDia.get(d) || [], fora = d.slice(0, 7) !== mes, late = d < hoje && l.length > 0;
              return (
                <div key={d} role="gridcell" aria-selected={sel === d} className={`pcal-d${fora ? " out" : ""}${d === hoje ? " today" : ""}${sel === d ? " sel" : ""}${late ? " late" : ""}`}>
                  <button className="dn" onClick={() => setSel(sel === d ? null : d)} aria-label={`${F_DIA.format(local(d))}${l.length ? `, ${l.length} ${l.length === 1 ? "prazo" : "prazos"}` : ""}`}>
                    {Number(d.slice(8))}{compact && l.length > 0 && <span className="dots">{l.slice(0, 3).map((x) => <i key={x.id} className={`v-${x.vez || "x"}`} />)}</span>}
                  </button>
                  {!compact && <div className="evs">
                    {l.slice(0, 3).map((x) => <button key={x.id} className={`ev v-${x.vez || "x"}`} onClick={() => onOpen(x.id)} title={`${x.nome}: ${x.proximaAcao || "sem próximo passo"}`}>{x.nome}</button>)}
                    {l.length > 3 && <button className="ev more" onClick={() => setSel(d)}>+{l.length - 3}</button>}
                  </div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="pcal-ag">
        <div className="pcal-agh">
          {sel ? <><b>{F_DIA.format(local(sel))}</b><button className="txtbtn" onClick={() => setSel(null)}>Ver todos os prazos</button></>
            : <b>Próximos passos com prazo</b>}
        </div>
        {grupos.length === 0 ? <p className="dempty">{sel ? "Nada marcado para este dia." : "Não há próximos passos com prazo."}</p> : grupos.map((g) => (
          <div key={g.t} className={`ag-g${g.t === "Atrasados" ? " late" : ""}`}>
            {!sel && <h4>{g.t}<span>{g.l.length}</span></h4>}
            <ul>{g.l.map((d) => <AgendaItem key={d.id} d={d} onOpen={onOpen} showDate={!sel} />)}</ul>
          </div>
        ))}
        {semPrazo > 0 && <p className="dnote">{semPrazo} {semPrazo === 1 ? "startup em curso sem prazo" : "startups em curso sem prazo"} no próximo passo.</p>}
      </div>
    </div>
  );
}
