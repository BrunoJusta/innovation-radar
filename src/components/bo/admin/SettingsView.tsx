"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_SETTINGS, Settings } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { AdmHead, errMsg, useFlash } from "./common";
import { useSession } from "../AuthGate";
import { PROMPT_SCOUTING } from "@/lib/scouting";
import { fdLongo } from "@/lib/util";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v)));

/** Regras da recolha: as das notícias ou as das startups (guardadas no mesmo documento settings/geral). */
export function SettingsView({ scope }: { scope: "news" | "startups" }) {
  const [s, setS] = useState<Settings | null>(null);
  const { flash, el } = useFlash();
  const { email } = useSession();
  // Prompt de scouting (config/scouting): enquanto não for guardado, a recolha usa o sugerido
  const [prompt, setPrompt] = useState<string | null>(scope === "startups" ? null : "");
  const [meta, setMeta] = useState<{ em?: string; por?: string }>({});
  useEffect(() => {
    const put = (v: Settings) => setS(v);
    getDoc(doc(db, "settings", "geral")).then((d) => put({ ...DEFAULT_SETTINGS, ...(d.data() || {}) })).catch(() => put(DEFAULT_SETTINGS));
    if (scope === "startups") getDoc(doc(db, "config", "scouting"))
      .then((d) => { setPrompt(d.exists() ? String(d.data()?.texto || "") : PROMPT_SCOUTING); setMeta({ em: d.data()?.atualizadoEm, por: d.data()?.atualizadoPor }); })
      .catch(() => setPrompt(PROMPT_SCOUTING));
  }, [scope]);
  if (!s || prompt === null) return <div className="loading">A carregar…</div>;

  const save = async () => {
    const v: Partial<Settings> = scope === "news"
      ? { corteRelevancia: clamp(s.corteRelevancia, 0, 100), janelaDias: clamp(s.janelaDias, 7, 365) }
      : { corteStartups: clamp(s.corteStartups ?? 50, 0, 100) };
    try {
      await setDoc(doc(db, "settings", "geral"), v, { merge: true }); setS({ ...s, ...v });
      if (scope === "startups") {
        const em = new Date().toISOString();
        await setDoc(doc(db, "config", "scouting"), { texto: prompt.trim(), atualizadoEm: em, atualizadoPor: email });
        setMeta({ em, por: email });
      }
      flash("Regras guardadas");
    } catch (e) { flash(errMsg(e)); }
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
        <p className="hint">Startups abaixo do corte são descartadas e não voltam a ser propostas nas recolhas seguintes. A pesquisa manual (Procurar online) mostra todas, para decidires tu.</p>
        <label className="fld"><span>Prompt de scouting (contexto da recolha)</span>
          <textarea className="long" rows={18} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Vazio: a pesquisa usa só as categorias e as pesquisas de cada categoria, sem contexto extra." /></label>
        <p className="hint">Diz à pesquisa o que procurar e como pontuar: tese, temas prioritários, fase e tamanho da ronda, caso de uso para a Sogrape. Vale para a recolha semanal, para Procurar online e para as fichas feitas a partir de um site. As guidelines de Critérios de investimento vão sempre junto, por isso não é preciso colá-las aqui. A relevância que o prompt define é a que o corte acima filtra. {meta.em ? `Atualizado em ${fdLongo(meta.em)}${meta.por ? ` por ${meta.por}` : ""}.` : "Ainda não foi guardado: a recolha está a usar o prompt sugerido."} Vazio desliga.</p>

        <div className="factions"><button className="btn primary" onClick={save}><Icon name="check" />Guardar</button>
          {prompt.trim() !== PROMPT_SCOUTING.trim() && <button className="btn" onClick={() => setPrompt(PROMPT_SCOUTING)}><Icon name="arrow-u-up-left" />Repor o prompt sugerido</button>}</div>
      </div>
    </>)}
    {el}
  </>);
}
