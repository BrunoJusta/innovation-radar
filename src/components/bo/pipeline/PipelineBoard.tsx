"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { moveDeal } from "@/lib/deal-actions";
import { Deal, ETAPAS_ATIVAS, Etapa, VERTICAIS_DF, VEZES } from "@/lib/types";
import { fdCurto } from "@/lib/util";
import { useSession } from "../AuthGate";

export const diasDesde = (iso: string | null | undefined) => { const t = Date.parse(iso || ""); return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 864e5)); };
/** Estado do prazo: atrasado, nos próximos 3 dias, ou sem urgência. */
export function prazoEstado(d: Pick<Deal, "prazo" | "etapa">): "atrasado" | "breve" | "" {
  if (!d.prazo || d.etapa === "arquivada") return "";
  const dias = Math.floor((Date.parse(d.prazo) - Date.parse(new Date().toISOString().slice(0, 10))) / 864e5);
  return dias < 0 ? "atrasado" : dias <= 3 ? "breve" : "";
}
const nm = <T extends { id: string; nome: string }>(l: T[], id: string | null | undefined) => l.find((x) => x.id === id)?.nome || "";

export function DealCard({ d, onOpen, drag }: { d: Deal; onOpen: () => void; drag?: boolean }) {
  const pz = prazoEstado(d), dias = diasDesde(d.etapaDesde);
  const vez = VEZES.find((v) => v.id === d.vez);
  return (
    <article className={`dcard${pz ? ` pz-${pz}` : ""}`} draggable={drag} onDragStart={(e) => { e.dataTransfer.setData("text/deal", d.id); e.dataTransfer.effectAllowed = "move"; }}
      role="button" tabIndex={0} aria-label={`Abrir ${d.nome}`} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      <div className="dc1"><b>{d.nome}</b>{d.analiseResumo && <span className={`anchip ${d.analiseResumo.decisao}`} title="Análise de investimento"><Icon name="scales" />{d.analiseResumo.decisao === "investir" ? "Investir" : "Não"}</span>}</div>
      <div className="dc2">{[nm(VERTICAIS_DF, d.vertical), d.pais].filter(Boolean).join(" · ") || "Sem vertical"}</div>
      {d.proximaAcao && <p className="dcn">{d.proximaAcao}</p>}
      <div className="dc3">
        {vez && <span className={`vez v-${vez.id}`}>{vez.curto}</span>}
        {d.prazo && <span className={`pz ${pz === "atrasado" ? "late" : pz === "breve" ? "soon" : ""}`} title="Prazo"><Icon name="calendar-blank" />{fdCurto(d.prazo)}</span>}
        <span className="sp" />
        <span className={`dias${dias > 30 ? " old" : ""}`} title="Dias nesta fase">{dias} d</span>
      </div>
    </article>
  );
}

/** Quadro do pipeline: uma coluna por fase; arrastar um cartão muda a fase. */
export function PipelineBoard({ deals, onOpen, notify }: { deals: Deal[]; onOpen: (id: string) => void; notify: (m: string) => void }) {
  const { email } = useSession();
  const [over, setOver] = useState<Etapa | null>(null);
  const drop = (e: React.DragEvent, etapa: Etapa) => {
    e.preventDefault(); setOver(null);
    const d = deals.find((x) => x.id === e.dataTransfer.getData("text/deal"));
    if (d && d.etapa !== etapa) moveDeal(d, etapa, email).then(() => notify(`«${d.nome}» passou para ${nm(ETAPAS_ATIVAS, etapa)}`)).catch(() => notify("Não foi possível mudar a fase."));
  };
  return (
    <div className="board">
      {ETAPAS_ATIVAS.map((e) => {
        const l = deals.filter((d) => d.etapa === e.id);
        const late = l.filter((d) => prazoEstado(d) === "atrasado").length;
        return (
          <section key={e.id} className={`bcol${over === e.id ? " over" : ""}`} aria-label={e.nome}
            onDragOver={(ev) => { ev.preventDefault(); setOver(e.id); }} onDragLeave={() => setOver(null)} onDrop={(ev) => drop(ev, e.id)}>
            <header title={e.desc}><b>{e.nome}</b><span className="c soft">{l.length}</span>{late > 0 && <span className="late-n" title="Com prazo ultrapassado">{late} atrasada{late > 1 ? "s" : ""}</span>}</header>
            <div className="bcards">
              {l.map((d) => <DealCard key={d.id} d={d} drag onOpen={() => onOpen(d.id)} />)}
              {!l.length && <p className="bempty">Sem startups</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
