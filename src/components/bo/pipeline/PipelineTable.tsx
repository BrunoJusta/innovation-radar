"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { nomeEtapa, passosAbertos } from "@/lib/deal-actions";
import { Deal, ETAPAS, MOTIVOS_ARQUIVO, ORIGENS_DF, VERTICAIS_DF, VEZES } from "@/lib/types";
import { fdCurto, nDias } from "@/lib/util";

const F_DATA = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "2-digit" });
const fdData = (iso: string) => { const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso); return isNaN(+d) ? "" : F_DATA.format(d); };
import { diasDesde, prazoEstado } from "./PipelineBoard";
import { AnaliseLoading, useAnaliseQueue } from "../AnaliseQueue";
import { alvoDeal } from "./DealDrawer";

type Col = "ref" | "nome" | "etapa" | "vez" | "prazo" | "vertical" | "pais" | "origem" | "entrada" | "motivo" | "arquivo";
const nm = <T extends { id: string; nome: string }>(l: T[], id: string | null | undefined) => l.find((x) => x.id === id)?.nome || "";
const ORD = Object.fromEntries(ETAPAS.map((e, i) => [e.id, i]));

/** Vista em lista do pipeline (ativas ou arquivadas), com colunas ordenáveis. */
export function PipelineTable({ deals, arquivadas, onOpen }: { deals: Deal[]; arquivadas: boolean; onOpen: (id: string) => void }) {
  const { running } = useAnaliseQueue();
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>(arquivadas ? { col: "arquivo", dir: -1 } : { col: "etapa", dir: 1 });
  const rows = useMemo(() => {
    const v = (d: Deal): string | number => {
      switch (sort.col) {
        case "ref": return d.ref || "zzz"; case "nome": return d.nome.toLowerCase(); case "etapa": return ORD[d.etapa] ?? 99;
        case "vez": return d.vez || "zzz"; case "prazo": return d.prazo || "9999"; case "vertical": return nm(VERTICAIS_DF, d.vertical) || "zzz";
        case "pais": return d.pais || "zzz"; case "origem": return d.origem?.nome || "zzz"; case "entrada": return d.entrada || "";
        case "motivo": return nm(MOTIVOS_ARQUIVO, d.arquivo?.motivo) || "zzz"; case "arquivo": return d.arquivo?.em || "";
      }
    };
    return [...deals].sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.nome.localeCompare(b.nome); });
  }, [deals, sort]);
  // Função (não componente): o botão de ordenar não é recriado e mantém o foco
  const Th = ({ col, children, cls = "" }: { col: Col; children: React.ReactNode; cls?: string }) => (
    <th key={col} className={cls} aria-sort={sort.col === col ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="thb" onClick={() => setSort(sort.col === col ? { col, dir: sort.dir === 1 ? -1 : 1 } : { col, dir: col === "entrada" || col === "arquivo" ? -1 : 1 })}>
        {children}<Icon name={sort.col === col ? (sort.dir === 1 ? "caret-up" : "caret-down") : "caret-up-down"} /></button></th>
  );
  return (
    <div className="tbl stbl ptbl">
      <table>
        <thead><tr>
          {Th({ col: "ref", children: "Ref" })}{Th({ col: "nome", children: "Startup" })}
          {arquivadas ? <>{Th({ col: "motivo", children: "Motivo" })}{Th({ col: "arquivo", cls: "n", children: "Arquivada" })}</> : <>{Th({ col: "etapa", children: "Fase" })}{Th({ col: "vez", children: "Vez" })}<th>Próximo passo</th>{Th({ col: "prazo", cls: "n", children: "Prazo" })}</>}
          {Th({ col: "vertical", children: "Vertical" })}{Th({ col: "pais", children: "País" })}{Th({ col: "origem", children: "Origem" })}{Th({ col: "entrada", cls: "n", children: "Entrada" })}<th>Análise</th>
        </tr></thead>
        <tbody>{rows.map((d) => {
          const pz = prazoEstado(d), vez = VEZES.find((v) => v.id === d.vez), mais = passosAbertos(d).length - 1;
          return (
            <tr key={d.id} tabIndex={0} onClick={() => onOpen(d.id)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(d.id); }}>
              <td className="mut refc">{d.ref}</td>
              <td><div className="tname"><span className="slogo">{d.nome.slice(0, 1).toUpperCase()}</span><div><b>{d.nome}</b><span className="mut sm">{d.fundadores}</span></div></div></td>
              {arquivadas ? <>
                <td title={d.arquivo?.nota || ""}>{nm(MOTIVOS_ARQUIVO, d.arquivo?.motivo)}{d.arquivo?.nota && <span className="mut sm clip">{d.arquivo.nota}</span>}</td>
                <td className="n mut">{d.arquivo?.em ? fdData(d.arquivo.em) : ""}</td>
              </> : <>
                <td><span className="tg">{nomeEtapa(d.etapa)}</span><span className="mut sm">{nDias(diasDesde(d.etapaDesde))}</span></td>
                <td>{vez ? <span className={`vez v-${vez.id}`}>{vez.curto}</span> : <span className="mut">-</span>}</td>
                <td className="fin">{d.proximaAcao || <span className="mut">-</span>}{mais > 0 && <span className="pmais"> +{mais}</span>}{d.responsavel && <span className="mut sm">{d.responsavel.split("@")[0]}</span>}</td>
                <td className="n">{d.prazo ? <span className={`pz ${pz === "atrasado" ? "late" : pz === "breve" ? "soon" : ""}`}>{fdCurto(d.prazo)}</span> : <span className="mut">-</span>}</td>
              </>}
              <td>{nm(VERTICAIS_DF, d.vertical) || <span className="mut">-</span>}</td>
              <td>{d.pais || <span className="mut">-</span>}</td>
              <td>{d.origem?.nome || nm(ORIGENS_DF, d.origem?.tipo)}</td>
              <td className="n mut">{d.entrada ? fdData(d.entrada) : ""}</td>
              <td>{running.has(alvoDeal(d).path) ? <AnaliseLoading path={alvoDeal(d).path} /> : d.analiseResumo ? <span className={`anchip ${d.analiseResumo.decisao}`}>{d.analiseResumo.decisao === "investir" ? "Investir" : "Não investir"}</span> : <span className="mut">-</span>}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}
