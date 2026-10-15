"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_SETTINGS, Settings } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { AdmHead, errMsg, useFlash } from "./common";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v)));

/** Regras da recolha: as das notícias ou as das startups (guardadas no mesmo documento settings/geral). */
export function SettingsView({ scope }: { scope: "news" | "startups" }) {
  const [s, setS] = useState<Settings | null>(null);
  const { flash, el } = useFlash();
  useEffect(() => { getDoc(doc(db, "settings", "geral")).then((d) => setS({ ...DEFAULT_SETTINGS, ...(d.data() || {}) })).catch(() => setS(DEFAULT_SETTINGS)); }, []);
  if (!s) return <div className="loading">A carregar…</div>;

  const save = async () => {
    const v: Partial<Settings> = scope === "news"
      ? { corteRelevancia: clamp(s.corteRelevancia, 0, 100), janelaDias: clamp(s.janelaDias, 7, 365) }
      : { corteStartups: clamp(s.corteStartups ?? 50, 0, 100) };
    try { await setDoc(doc(db, "settings", "geral"), v, { merge: true }); setS({ ...s, ...v }); flash("Regras guardadas"); } catch (e) { flash(errMsg(e)); }
  };

  return (<>
    {scope === "news" ? (<>
      <AdmHead title="Regras das notícias" text="O que a recolha diária deixa passar e o período que o radar mostra." />
      <div className="form">
        <div className="fgrid">
          <label className="fld"><span>Corte de relevância (0 a 100)</span>
            <input type="number" min={0} max={100} value={s.corteRelevancia} onChange={(e) => setS({ ...s, corteRelevancia: +e.target.value })} /></label>
          <label className="fld"><span>Janela do radar (dias)</span>
            <input type="number" min={7} max={365} value={s.janelaDias} onChange={(e) => setS({ ...s, janelaDias: +e.target.value })} /></label>
        </div>
        <p className="hint">Notícias abaixo do corte são descartadas pela recolha e não chegam à triagem. A janela define o período que o radar mostra por defeito; os trimestres anteriores continuam disponíveis no seletor do radar.</p>
        <div className="factions"><button className="btn primary" onClick={save}><Icon name="check" />Guardar</button></div>
      </div>
    </>) : (<>
      <AdmHead title="Regras das startups" text="O que a recolha semanal de startups deixa passar para a triagem." />
      <div className="form">
        <div className="fgrid">
          <label className="fld"><span>Corte de relevância (0 a 100)</span>
            <input type="number" min={0} max={100} value={s.corteStartups ?? 50} onChange={(e) => setS({ ...s, corteStartups: +e.target.value })} /></label>
        </div>
        <p className="hint">Startups abaixo do corte são descartadas e não voltam a ser propostas nas recolhas seguintes. A pesquisa à mão (Procurar online) mostra todas, para decidires tu.</p>
        <div className="factions"><button className="btn primary" onClick={save}><Icon name="check" />Guardar</button></div>
      </div>
    </>)}
    {el}
  </>);
}
