"use client";
import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";

export function AdmHead({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="head adm-head">
      <div><h2>{title}</h2><p>{text}</p></div>
      {children && <div className="adm-act">{children}</div>}
    </div>
  );
}

/** Botão de apagar em dois cliques (evita diálogos do browser). */
export function DangerBtn({ onConfirm, label = "Remover" }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);
  return armed
    ? <span className="arm"><button className="txtbtn" onClick={() => setArmed(false)}>Cancelar</button><button className="btn danger" onClick={() => { setArmed(false); onConfirm(); }}>Confirmar</button></span>
    : <button className="btn icon" title={label} aria-label={label} onClick={() => setArmed(true)}><Icon name="trash" /></button>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="tgl" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}><i /></button>;
}

export function useFlash() {
  const [msg, setMsg] = useState("");
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const flash = (m: string) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(""), 4000); };
  // A região "status" fica sempre montada para os leitores de ecrã anunciarem as mensagens
  const el = <div className={msg ? "toast" : "sr"} role="status" aria-live="polite">{msg && <span>{msg}</span>}</div>;
  return { flash, el };
}

export const errMsg = (e: unknown) => "Não foi possível guardar. " + ((e as { code?: string }).code === "permission-denied" ? "Não tens permissão." : "Tenta outra vez.");

/** Formulário de criar ou editar numa janela por cima da página (em vez de aparecer no fundo). */
export function FormModal({ title, onClose, onSave, saveLabel = "Guardar", children }: {
  title: string; onClose: () => void; onSave: () => void | Promise<unknown>; saveLabel?: string; children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    box.current?.querySelector<HTMLElement>("input,textarea,select")?.focus();
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", k); };
  }, [onClose]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); try { await onSave(); } finally { setBusy(false); }
  };
  return (<>
    <div className="scrim" onClick={() => !busy && onClose()} />
    <form ref={box} className="mdl wide" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
      <div className="mdl-h"><h2>{title}</h2><button type="button" className="btn icon" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button></div>
      <div className="mdl-b scroll fmodal">{children}</div>
      <div className="mdl-f"><span className="sp" />
        <button type="button" className="txtbtn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? <><span className="spin" aria-hidden="true" />A guardar…</> : <><Icon name="check" />{saveLabel}</>}</button>
      </div>
    </form>
  </>);
}
