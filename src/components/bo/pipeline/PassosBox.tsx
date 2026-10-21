"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { novoPasso, ordemPassos, passosDe, savePassos } from "@/lib/deal-actions";
import { Deal, Passo, VEZES, Vez } from "@/lib/types";
import { fdCurto, fdLongo, hojeLocal } from "@/lib/util";
import { estadoPrazo } from "./PipelineBoard";
import { useConfirm } from "../Confirm";

const pzCls = (p: string | null) => { const e = estadoPrazo(p); return e === "atrasado" ? "late" : e === "breve" ? "soon" : ""; };

/** Próximos passos de uma startup do pipeline: vários em aberto, cada um com a vez, o prazo e o responsável. */
export function PassosBox({ d, pessoas, by, act }: {
  d: Deal; pessoas: string[]; by: string; act: (p: Promise<unknown>, msg: string) => Promise<unknown> | void;
}) {
  const todos = passosDe(d);
  const abertos = todos.filter((p) => !p.feito).sort(ordemPassos);
  const feitos = todos.filter((p) => p.feito).sort((a, b) => (b.feito || "").localeCompare(a.feito || ""));
  const [edit, setEdit] = useState<Passo | null>(null);
  const [verFeitos, setVerFeitos] = useState(false);
  useEffect(() => { setEdit(null); setVerFeitos(false); }, [d.id]);

  const isNew = !!edit && !todos.some((p) => p.id === edit.id);
  const guardar = () => {
    if (!edit || !edit.texto.trim()) return;
    const p = { ...edit, texto: edit.texto.trim(), responsavel: edit.responsavel.trim() };
    const l = isNew ? [...todos, p] : todos.map((x) => (x.id === p.id ? p : x));
    act(savePassos(d, l).then(() => setEdit(null)), isNew ? "Passo acrescentado" : "Passo guardado");
  };
  const concluir = (p: Passo) => act(savePassos(d, todos.map((x) => (x.id === p.id ? { ...x, feito: hojeLocal(), feitoPor: by } : x)), by, `Passo concluído: ${p.texto}`), "Passo concluído");
  const reabrir = (p: Passo) => act(savePassos(d, todos.map((x) => (x.id === p.id ? { ...x, feito: null, feitoPor: "" } : x))), "Passo reaberto");
  const { confirmar, el: cfEl } = useConfirm();
  const apagar = async (p: Passo) => { if (await confirmar({ titulo: `Apagar o passo «${p.texto}»?`, texto: "Não dá para anular.", ok: "Apagar", perigo: true })) act(savePassos(d, todos.filter((x) => x.id !== p.id)), "Passo apagado"); };

  const form = edit && (
    <div className="pform" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEdit(null); } }}>
      <div className="seg vezseg" role="group" aria-label="De quem é a vez">
        {VEZES.map((v) => <button key={v.id} type="button" aria-pressed={edit.vez === v.id} onClick={() => setEdit({ ...edit, vez: edit.vez === v.id ? null : v.id as Vez })}>{v.curto}</button>)}
      </div>
      <div className="fgrid">
        <label className="fld wide"><span>O que falta fazer</span>
          <input autoFocus autoComplete="off" value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") guardar(); }} placeholder="ex.: enviar o deck à Beta Capital" /></label>
        <label className="fld"><span>Prazo</span><input type="date" value={edit.prazo || ""} onChange={(e) => setEdit({ ...edit, prazo: e.target.value || null })} /></label>
        <label className="fld"><span>Responsável</span><input list="df-pessoas" autoComplete="off" value={edit.responsavel} onChange={(e) => setEdit({ ...edit, responsavel: e.target.value })} placeholder="nome ou email" /></label>
      </div>
      <div className="factions"><button type="button" className="txtbtn" onClick={() => setEdit(null)}>Cancelar</button>
        <button type="button" className="btn primary" disabled={!edit.texto.trim()} onClick={guardar}><Icon name={isNew ? "plus" : "check"} />{isNew ? "Acrescentar" : "Guardar"}</button></div>
    </div>
  );

  return (
    <div className="blk nextbox">
      <div className="bh"><h4>Próximos passos{abertos.length > 1 && <span className="pcount">{abertos.length}</span>}</h4>
        {!edit && <button className="txtbtn" onClick={() => setEdit(novoPasso({ responsavel: by }))}><Icon name="plus" />Acrescentar passo</button>}</div>
      <datalist id="df-pessoas">{pessoas.map((p) => <option key={p} value={p} />)}</datalist>
      {abertos.length === 0 && !isNew && <p className="hint">Sem próximos passos. Acrescenta o que falta fazer, de quem é a vez e até quando.</p>}
      {abertos.length > 0 && <ul className="passos">{abertos.map((p) => edit?.id === p.id ? <li key={p.id} className="pedit">{form}</li> : (
        <li key={p.id} className={`passo${estadoPrazo(p.prazo) === "atrasado" ? " late" : ""}`}>
          <button className="pchk" title="Marcar como feito" aria-label={`Marcar como feito: ${p.texto}`} onClick={() => concluir(p)}><Icon name="check" /></button>
          <div className="pb"><b>{p.texto || "Sem descrição"}</b>
            <span className="pm">{(() => { const v = VEZES.find((x) => x.id === p.vez); return v ? <span className={`vez v-${v.id}`}>{v.curto}</span> : null; })()}
              {p.prazo && <span className={`pz ${pzCls(p.prazo)}`}><Icon name="calendar-blank" />{fdCurto(p.prazo)}</span>}
              {p.responsavel && <em>{p.responsavel.split("@")[0]}</em>}</span></div>
          <span className="pa">
            <button className="tlx" title="Editar" aria-label={`Editar: ${p.texto}`} onClick={() => setEdit(p)}><Icon name="pencil-simple" /></button>
            <button className="tlx" title="Apagar" aria-label={`Apagar: ${p.texto}`} onClick={() => apagar(p)}><Icon name="trash" /></button></span>
        </li>))}</ul>}
      {isNew && form}
      {feitos.length > 0 && <>
        <button className="txtbtn pfeitos" aria-expanded={verFeitos} onClick={() => setVerFeitos(!verFeitos)}>
          <Icon name={verFeitos ? "caret-up" : "caret-down"} />{feitos.length} {feitos.length === 1 ? "passo feito" : "passos feitos"}</button>
        {verFeitos && <ul className="passos feitos">{feitos.map((p) => (
          <li key={p.id} className="passo done">
            <button className="pchk on" title="Voltar a abrir" aria-label={`Voltar a abrir: ${p.texto}`} onClick={() => reabrir(p)}><Icon name="check" /></button>
            <div className="pb"><b>{p.texto}</b><span className="pm"><em>Feito a {fdLongo(p.feito!)}{p.feitoPor ? ` por ${p.feitoPor.split("@")[0]}` : ""}</em></span></div>
            <span className="pa"><button className="tlx" title="Apagar" aria-label={`Apagar: ${p.texto}`} onClick={() => apagar(p)}><Icon name="trash" /></button></span>
          </li>))}</ul>}
      </>}
      {cfEl}
    </div>
  );
}
