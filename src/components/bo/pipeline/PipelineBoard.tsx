"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { archiveDeal, moveDeal, passosAbertos } from "@/lib/deal-actions";
import { Deal, ETAPAS_ATIVAS, ETAPAS_FINAIS, Etapa, MOTIVOS_ARQUIVO, MotivoArquivo, VERTICAIS_DF, VEZES, DECISOES, emCurso } from "@/lib/types";
import { fdCurto, hojeLocal, nDias } from "@/lib/util";
import { useSession } from "../AuthGate";
import { AnaliseLoading } from "../AnaliseQueue";
import { Logo } from "../startups/Logo";

export const diasDesde = (iso: string | null | undefined) => { const t = Date.parse(iso || ""); return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 864e5)); };
/** Estado do prazo: atrasado, nos próximos 3 dias, ou sem urgência. */
export function estadoPrazo(prazo: string | null | undefined): "atrasado" | "breve" | "" {
  if (!prazo) return "";
  const dias = Math.round((Date.parse(prazo) - Date.parse(hojeLocal())) / 864e5);
  return dias < 0 ? "atrasado" : dias <= 3 ? "breve" : "";
}
export const prazoEstado = (d: Pick<Deal, "prazo" | "etapa">) => !emCurso(d.etapa) ? "" : estadoPrazo(d.prazo);
const nm = <T extends { id: string; nome: string }>(l: T[], id: string | null | undefined) => l.find((x) => x.id === id)?.nome || "";

export function DealCard({ d, onOpen, drag }: { d: Deal; onOpen: () => void; drag?: boolean }) {
  const pz = prazoEstado(d), dias = diasDesde(d.etapaDesde);
  const vez = VEZES.find((v) => v.id === d.vez), mais = passosAbertos(d).length - 1;
  return (
    <article className={`dcard${pz ? ` pz-${pz}` : ""}`} draggable={drag} onDragStart={(e) => { e.dataTransfer.setData("text/deal", d.id); e.dataTransfer.effectAllowed = "move"; }}
      role="button" tabIndex={0} aria-label={`Abrir ${d.nome}`} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      <div className="dc1">{d.logo && <Logo nome={d.nome} logo={d.logo} />}<b>{d.nome}</b><AnaliseLoading path={d.startupId ? `startups/${d.startupId}` : `deals/${d.id}`} short />{d.analiseResumo && <span className={`anchip ${d.analiseResumo.decisao}`} title="Análise de investimento"><Icon name="scales" />{DECISOES[d.analiseResumo.decisao]?.curto}</span>}</div>
      <div className="dc2">{[nm(VERTICAIS_DF, d.vertical), d.pais].filter(Boolean).join(" · ") || "Sem vertical"}</div>
      {d.proximaAcao && <p className="dcn">{d.proximaAcao}{mais > 0 && <span className="pmais" title={`Mais ${mais} ${mais === 1 ? "passo" : "passos"} em aberto`}> +{mais}</span>}</p>}
      <div className="dc3">
        {vez && <span className={`vez v-${vez.id}`}>{vez.curto}</span>}
        {d.prazo && <span className={`pz ${pz === "atrasado" ? "late" : pz === "breve" ? "soon" : ""}`} title="Prazo"><Icon name="calendar-blank" />{fdCurto(d.prazo)}</span>}
        <span className="sp" />
        <span className={`dias${dias > 30 ? " old" : ""}`} title={`${nDias(dias)} nesta fase`}>{dias} d</span>
      </div>
    </article>
  );
}

/** Quadro do pipeline: uma coluna por fase em curso; a última coluna tem os três destinos (radar, investidas, arquivo). Arrastar um cartão muda a fase. */
export function PipelineBoard({ deals, todos, onOpen, notify }: { deals: Deal[]; todos?: Deal[]; onOpen: (id: string) => void; notify: (m: string) => void }) {
  const { email } = useSession();
  const [over, setOver] = useState<Etapa | null>(null);
  const [arq, setArq] = useState<Deal | null>(null);
  const [motivo, setMotivo] = useState<MotivoArquivo | "">("");
  const [nota, setNota] = useState("");
  const drop = (e: React.DragEvent, etapa: Etapa) => {
    e.preventDefault(); setOver(null);
    const d = deals.find((x) => x.id === e.dataTransfer.getData("text/deal"));
    if (!d || d.etapa === etapa) return;
    if (etapa === "arquivada") { setArq(d); setMotivo(""); setNota(""); return; }
    const nome = [...ETAPAS_ATIVAS, ...ETAPAS_FINAIS].find((x) => x.id === etapa)?.nome;
    moveDeal(d, etapa, email).then(() => notify(etapa === "radar" ? `«${d.nome}» passou para o radar` : etapa === "investida" ? `«${d.nome}» passou para as investidas` : `«${d.nome}» passou para ${nome}`)).catch(() => notify("Não foi possível mudar a fase."));
  };
  const nFinal = (id: Etapa) => (todos || []).filter((d) => d.etapa === id).length;
  const ICON: Record<string, string> = { radar: "globe", investida: "check-circle", arquivada: "prohibit" };
  return (<>
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
      <section className="bcol bfim" aria-label="Destinos finais">
        {ETAPAS_FINAIS.map((e) => (
          <div key={e.id} className={`bdest d-${e.id}${over === e.id ? " over" : ""}`} title={e.desc}
            onDragOver={(ev) => { ev.preventDefault(); setOver(e.id); }} onDragLeave={() => setOver(null)} onDrop={(ev) => drop(ev, e.id)}>
            <Icon name={ICON[e.id]} size={20} /><b>{e.id === "investida" ? "Investidas" : e.id === "arquivada" ? "Arquivo" : "Radar"}</b>
            <span>{nFinal(e.id)}</span><em>Larga aqui</em>
          </div>
        ))}
      </section>
    </div>
    {arq && (<>
      <div className="scrim" onClick={() => setArq(null)} />
      <div className="mdl" role="dialog" aria-modal="true" aria-labelledby="ba-t">
        <div className="mdl-h"><h2 id="ba-t">Arquivar «{arq.nome}»</h2><button className="btn icon" aria-label="Fechar" onClick={() => setArq(null)}><Icon name="x" /></button></div>
        <div className="mdl-b">
          <div className="reasons bare"><div className="rh">Porque arquivas?</div>
            <div className="rgrid">{MOTIVOS_ARQUIVO.filter((m) => m.id !== "sem-registo").map((m) => <button key={m.id} aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)}>{m.nome}</button>)}</div></div>
          <label className="fld"><span>Nota (opcional)</span><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que foi comunicado à startup" /></label>
        </div>
        <div className="mdl-f"><span className="sp" /><button className="txtbtn" onClick={() => setArq(null)}>Cancelar</button>
          <button className="btn primary" disabled={!motivo} onClick={() => { const d = arq; setArq(null); if (motivo) archiveDeal(d, motivo, nota.trim(), email).then(() => notify(`«${d.nome}» arquivada`)).catch(() => notify("Não foi possível arquivar.")); }}><Icon name="prohibit" />Arquivar</button></div>
      </div>
    </>)}
  </>);
}
