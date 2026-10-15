"use client";
import { Fragment, useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Run } from "@/lib/types";
import { Empty } from "../ui";
import { Icon } from "@/components/Icon";
import { AdmHead } from "./common";

const tot = (r: Run, k: "lidos" | "jaVistos" | "filtro" | "relevantes" | "novos" | "fundidos") => (r.fontes || []).reduce((a, f) => a + (f[k] || 0), 0);
const dt = (iso: string) => new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const dur = (r: Run) => r.fim ? Math.max(1, Math.round((+new Date(r.fim) - +new Date(r.inicio)) / 1000)) + " s" : "a correr";

export function RunsView() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => onSnapshot(query(collection(db, "runs"), orderBy("inicio", "desc"), limit(30)),
    (s) => setRuns(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Run)), () => setRuns([])), []);

  return (<>
    <AdmHead title="Execuções" text="Cada recolha, fonte a fonte (ou setor a setor, nas startups): quantos artigos foram lidos, quantos já tinham sido vistos, quantos passaram o filtro e quantos chegaram à triagem." />
    {runs === null ? <div className="loading">A carregar…</div>
      : runs.length === 0 ? <Empty icon={<Icon name="rss" size={22} />} title="Ainda não houve recolhas" text="A primeira execução aparece aqui depois de correr o workflow no GitHub (todos os dias às 6h30, ou manualmente)." />
      : <div className="tbl"><table>
          <thead><tr><th>Início</th><th>Recolha</th><th>Estado</th><th className="n">Lidos</th><th className="n">Já vistos</th><th className="n">Filtro</th><th className="n">Relevantes</th><th className="n">Novas</th><th className="n">Fundidas</th><th className="n">Duração</th></tr></thead>
          <tbody>{runs.map((r) => (<Fragment key={r.id}>
            <tr className="clk" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <td>{dt(r.inicio)}</td>
              <td>{r.tipo === "startups" ? "Startups" : "Notícias"}</td>
              <td><span className={`pill st-${r.estado === "ok" ? "ok" : r.estado === "erro" ? "no" : "run"}`}>{r.estado === "ok" ? "Concluída" : r.estado === "erro" ? "Erro" : "A correr"}</span></td>
              <td className="n">{tot(r, "lidos")}</td><td className="n">{tot(r, "jaVistos")}</td><td className="n">{tot(r, "filtro")}</td>
              <td className="n">{tot(r, "relevantes")}</td><td className="n"><b>{tot(r, "novos")}</b></td><td className="n">{tot(r, "fundidos")}</td><td className="n">{dur(r)}</td>
            </tr>
            {open === r.id && <tr className="sub"><td colSpan={10}>
              {r.erroGeral && <p className="gerr">{r.erroGeral}</p>}
              <table><tbody>{(r.fontes || []).map((f) => (
                <tr key={f.sourceId}><td>{f.nome}</td><td className="n">{f.lidos}</td><td className="n">{f.jaVistos}</td><td className="n">{f.filtro}</td><td className="n">{f.relevantes}</td><td className="n">{f.novos}</td><td className="n">{f.fundidos}</td>
                  <td className="note">{f.erros?.length ? f.erros.join(" · ") : "Sem erros"}</td></tr>))}</tbody></table>
            </td></tr>}
          </Fragment>))}</tbody>
        </table></div>}
  </>);
}
