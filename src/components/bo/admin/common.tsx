"use client";
import { useState } from "react";
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
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };
  const el = msg ? <div className="toast" role="status"><span>{msg}</span></div> : null;
  return { flash, el };
}

export const errMsg = (e: unknown) => "Não foi possível guardar. " + ((e as { code?: string }).code === "permission-denied" ? "Não tens permissão." : "Tenta outra vez.");
