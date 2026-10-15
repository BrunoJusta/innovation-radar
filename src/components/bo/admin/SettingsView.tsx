"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_SETTINGS, Settings } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { AdmHead, errMsg, useFlash } from "./common";

export function SettingsView() {
  const [s, setS] = useState<Settings | null>(null);
  const { flash, el } = useFlash();
  useEffect(() => { getDoc(doc(db, "settings", "geral")).then((d) => setS({ ...DEFAULT_SETTINGS, ...(d.data() || {}) })).catch(() => setS(DEFAULT_SETTINGS)); }, []);
  if (!s) return <div className="loading">A carregar…</div>;

  const save = async () => {
    const v = { corteRelevancia: Math.min(100, Math.max(0, Math.round(s.corteRelevancia))), janelaDias: Math.min(365, Math.max(7, Math.round(s.janelaDias))),
      corteStartups: Math.min(100, Math.max(0, Math.round(s.corteStartups ?? 50))) };
    try { await setDoc(doc(db, "settings", "geral"), v, { merge: true }); setS(v); flash("Definições guardadas"); } catch (e) { flash(errMsg(e)); }
  };

  return (<>
    <AdmHead title="Geral" text="Regras gerais da recolha e do radar." />
    <div className="form">
      <div className="fgrid">
        <label className="fld"><span>Corte de relevância (0 a 100)</span>
          <input type="number" min={0} max={100} value={s.corteRelevancia} onChange={(e) => setS({ ...s, corteRelevancia: +e.target.value })} /></label>
        <label className="fld"><span>Janela do radar (dias)</span>
          <input type="number" min={7} max={365} value={s.janelaDias} onChange={(e) => setS({ ...s, janelaDias: +e.target.value })} /></label>
        <label className="fld"><span>Corte de relevância das startups</span>
          <input type="number" min={0} max={100} value={s.corteStartups ?? 50} onChange={(e) => setS({ ...s, corteStartups: +e.target.value })} /></label>
      </div>
      <p className="hint">Notícias abaixo do corte são descartadas pela recolha e não chegam à triagem. A janela define o período que o radar mostra por defeito; os trimestres anteriores continuam disponíveis no seletor do radar. As startups abaixo do seu corte não chegam à triagem.</p>
      <div className="factions"><button className="btn primary" onClick={save}><Icon name="check" />Guardar</button></div>
    </div>
    {el}
  </>);
}
