"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { createDeal, DEAL_VAZIO, findDeal, nomeEtapa, proximaRef } from "@/lib/deal-actions";
import { Deal, ETAPAS_ATIVAS, Etapa } from "@/lib/types";
import { useSession } from "../AuthGate";
import { useAnaliseQueue } from "../AnaliseQueue";
import { DealEdit, DealFields, pickDeal } from "./DealFields";

const dominio = (site: string) => site.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();

/** Pôr uma startup no pipeline à mão (candidatura, evento, recomendação…). */
export function NewDeal({ deals, origens, onClose, onDone }: { deals: Deal[]; origens: string[]; onClose: () => void; onDone: (id: string, msg: string) => void }) {
  const { email } = useSession();
  const { queue } = useAnaliseQueue();
  const [f, setF] = useState<DealEdit>(pickDeal(DEAL_VAZIO()));
  const [etapa, setEtapa] = useState<Etapa>("contacto");
  const [acao, setAcao] = useState("");
  const [analisar, setAnalisar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  const dup = f.nome.trim().length > 2 ? findDeal(deals, { id: "", nome: f.nome, dominio: dominio(f.site) }) : undefined;

  const guardar = async () => {
    if (!f.nome.trim()) { setErro("Indica o nome da startup."); return; }
    setBusy(true); setErro("");
    try {
      const d = { ...DEAL_VAZIO(), ...f, ref: proximaRef(deals), dominio: dominio(f.site), etapa, proximaAcao: acao.trim(), vez: "sogrape" as const };
      const id = await createDeal(d, email);
      if (analisar && f.site.trim()) queue({ path: `deals/${id}`, nome: d.nome, site: d.site, dominio: d.dominio, descricao: d.descricao, setor: "" });
      onDone(id, `«${d.nome}» no pipeline em ${nomeEtapa(etapa)}${analisar && f.site.trim() ? ". A análise de investimento corre em segundo plano." : ""}`);
    } catch (e) { setErro((e as { code?: string }).code === "permission-denied" ? "Sem permissão. O pipeline é só para administradores; confirma também que as regras do Firestore estão publicadas." : "Não foi possível guardar."); setBusy(false); }
  };

  return (<>
    <div className="scrim" onClick={() => !busy && onClose()} />
    <div className="mdl wide" role="dialog" aria-modal="true" aria-labelledby="nd-t">
      <div className="mdl-h"><h2 id="nd-t">Nova startup no pipeline</h2><button className="btn icon" aria-label="Fechar" onClick={onClose} disabled={busy}><Icon name="x" /></button></div>
      <div className="mdl-b scroll">
        {dup && <div className="notice warn"><Icon name="warning-circle" /><span>Já existe «{dup.nome}» no pipeline ({nomeEtapa(dup.etapa)}{dup.arquivo?.em ? `, arquivada em ${dup.arquivo.em.slice(0, 7)}` : ""}). Confirma que não é a mesma.</span></div>}
        <div className="fgrid">
          <label className="fld"><span>Entra em</span><select value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)}>{ETAPAS_ATIVAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
          <label className="fld wide"><span>Próximo passo</span><input value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="ex.: marcar intro meeting" /></label>
        </div>
        <DealFields value={f} onChange={(p) => setF({ ...f, ...p })} origens={origens} />
        {erro && <p className="gerr" role="alert">{erro}</p>}
      </div>
      <div className="mdl-f"><span className="sp" />
        <label className="anchk" title="Precisa do site da startup"><input type="checkbox" checked={analisar} disabled={!f.site.trim()} onChange={(e) => setAnalisar(e.target.checked)} />Fazer análise de investimento</label>
        <button className="btn primary" onClick={guardar} disabled={busy}><Icon name="plus" />Pôr no pipeline</button></div>
    </div>
  </>);
}
