"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

type Pedido = { titulo: string; texto?: string; ok?: string; perigo?: boolean; /** Palavra a escrever para confirmar (ex.: DELETE). */ escrever?: string; res: (v: boolean) => void };

/**
 * Pop-up de confirmação do backoffice (em vez do alerta do browser).
 * const { confirmar, el } = useConfirm(); if (await confirmar({ titulo: "Apagar?" })) …; e pôr {el} no JSX.
 */
export function useConfirm() {
  const [p, setP] = useState<Pedido | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  const [txt, setTxt] = useState("");
  const confirmar = useCallback((o: Omit<Pedido, "res">) => new Promise<boolean>((res) => { setTxt(""); setP({ ...o, res }); }), []);
  const fechar = (v: boolean) => { p?.res(v); setP(null); };
  useEffect(() => {
    if (!p) return;
    setTimeout(() => (inRef.current || okRef.current)?.focus(), 0);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); fechar(false); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const el = p && (<>
    <div className="scrim top cfs" onClick={() => fechar(false)} />
    <div className="mdl cfm" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby={p.texto ? "cf-d" : undefined}>
      <div className="mdl-b">
        <div className="cfh"><span className={`cfi${p.perigo ? " danger" : ""}`}><Icon name={p.perigo ? "trash" : "question"} size={18} /></span>
          <div><h2 id="cf-t">{p.titulo}</h2>{p.texto && <p id="cf-d">{p.texto}</p>}</div></div>
        {p.escrever && (
          <form className="cfw" onSubmit={(e) => { e.preventDefault(); if (txt === p.escrever) fechar(true); }}>
            <label className="fld"><span>Para confirmar, escreve <b translate="no">{p.escrever}</b></span>
              <input ref={inRef} value={txt} onChange={(e) => setTxt(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={p.escrever} /></label>
          </form>)}
      </div>
      <div className="mdl-f"><span className="sp" />
        <button className="txtbtn" onClick={() => fechar(false)}>Cancelar</button>
        <button ref={okRef} className={`btn ${p.perigo ? "danger" : "primary"}`} disabled={!!p.escrever && txt !== p.escrever} onClick={() => fechar(true)}>{p.ok || "Confirmar"}</button>
      </div>
    </div>
  </>);
  return { confirmar, el };
}
