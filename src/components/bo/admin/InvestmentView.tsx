"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CRITERIOS, DEFAULT_SETTINGS, GRUPOS_CRITERIOS, MATRIZ, TICKETS } from "@/lib/types";
import { fdLongo } from "@/lib/util";
import { Icon } from "@/components/Icon";
import { useSession } from "../AuthGate";
import { AdmHead, errMsg, useFlash } from "./common";

/** Guidelines de investimento (privadas, em config/investimento) e regras da análise automática. */
export function InvestmentView() {
  const { email } = useSession();
  const [texto, setTexto] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ em?: string; por?: string }>({});
  const [corte, setCorte] = useState(DEFAULT_SETTINGS.corteAnalise ?? 75);
  const { flash, el } = useFlash();
  useEffect(() => {
    getDoc(doc(db, "config", "investimento")).then((d) => { setTexto(d.data()?.texto || ""); setMeta({ em: d.data()?.atualizadoEm, por: d.data()?.atualizadoPor }); }).catch(() => setTexto(""));
    getDoc(doc(db, "settings", "geral")).then((d) => { const v = d.data()?.corteAnalise; if (typeof v === "number") setCorte(v); }).catch(() => {});
  }, []);
  if (texto === null) return <div className="loading">A carregar…</div>;

  const save = async () => {
    try {
      const em = new Date().toISOString();
      await setDoc(doc(db, "config", "investimento"), { texto: texto.trim(), atualizadoEm: em, atualizadoPor: email });
      await setDoc(doc(db, "settings", "geral"), { corteAnalise: Math.max(0, Math.min(100, Math.round(corte))) }, { merge: true });
      setMeta({ em, por: email }); flash("Critérios guardados");
    } catch (e) { flash(errMsg(e)); }
  };

  return (<>
    <AdmHead title="Critérios de investimento" text="As guidelines da Sogrape Ventures que a análise de investimento usa. Só quem tem acesso ao backoffice as consegue ler." />
    <div className="form">
      <label className="fld"><span>Guidelines de investimento (texto)</span>
        <textarea className="long" rows={16} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cola aqui o texto do documento de guidelines: âmbito, critérios por ticket, desafios do ano e conclusões do comité." /></label>
      <p className="hint">{meta.em ? `Atualizadas em ${fdLongo(meta.em)}${meta.por ? ` por ${meta.por}` : ""}. ` : "Ainda não há guidelines. Sem elas, a análise usa só os critérios abaixo e não reconhece os desafios do ano. "}Quando sair a versão de um novo ano, basta substituir o texto.</p>
      <div className="fgrid">
        <label className="fld"><span>Análise automática a partir de (relevância 0 a 100)</span>
          <input type="number" min={0} max={100} value={corte} onChange={(e) => setCorte(+e.target.value)} /></label>
      </div>
      <p className="hint">A recolha semanal faz a análise às startups novas com esta relevância ou mais (no máximo 8 por semana). 0 desliga. No backoffice podes fazer a análise a qualquer startup, no painel da ficha.</p>
      <div className="factions"><button className="btn primary" onClick={save}><Icon name="check" />Guardar</button></div>
    </div>
    <div className="form crit-ref">
      <h3>Como a análise avalia</h3>
      {GRUPOS_CRITERIOS.map((g) => (
        <div key={g.id}><h4>{g.nome}</h4><ul>{CRITERIOS.filter((c) => c.grupo === g.id).map((c) => <li key={c.id}><b>{c.nome}.</b> {c.pergunta}</li>)}</ul></div>
      ))}
      <h4>Matriz por ticket</h4>
      <table className="an-mx ref"><thead><tr><th>Critério</th>{TICKETS.map((t) => <th key={t.id}>{t.nome}</th>)}</tr></thead>
        <tbody>{MATRIZ.map((m) => <tr key={m.criterio}><th>{m.nome}</th>{m.peso.map((w, i) => <td key={i} className={w ? `mx-req w${w}` : "mx-0"}>{w === 2 ? "Obrigatório" : w === 1 ? "Conta" : ""}</td>)}</tr>)}</tbody></table>
    </div>
    {el}
  </>);
}
