"use client";
import { useEffect, useMemo, useState } from "react";
import { dealsCsv } from "@/lib/deal-actions";
import { VEZES, Vez } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { useSession } from "../AuthGate";
import { useFlash } from "../admin/common";
import { Empty } from "../ui";
import { useDeals } from "./DealsLookup";
import { PipelineBoard, prazoEstado } from "./PipelineBoard";
import { PipelineTable } from "./PipelineTable";
import { DealDrawer } from "./DealDrawer";
import { PipelineCalendar } from "./PipelineCalendar";

type Estado = "ativas" | "arquivadas";
type Vista = "quadro" | "lista" | "calendario";
const VIEW_KEY = "radar.pipeline.vista";
const readView = (): Vista => { try { const v = localStorage.getItem(VIEW_KEY); return v === "lista" || v === "calendario" ? v : "quadro"; } catch { return "quadro"; } };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pipeline da Sogrape Ventures (página dentro de Startups): o seguimento do primeiro contacto ao investimento. */
export function PipelineSection({ search }: { search: string }) {
  const { email } = useSession();
  const { deals, loaded, erro } = useDeals();
  const [estado, setEstado] = useState<Estado>("ativas");
  const [vista, setVistaS] = useState<Vista>("quadro");
  useEffect(() => setVistaS(readView()), []);
  const setVista = (v: Vista) => { setVistaS(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* sem armazenamento */ } };
  const [vez, setVez] = useState<Vez | "">("");
  const [minhas, setMinhas] = useState(false);
  const [atrasadas, setAtrasadas] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { flash, el } = useFlash();

  const ativas = deals.filter((d) => d.etapa !== "arquivada"), arq = deals.filter((d) => d.etapa === "arquivada");
  const eu = email.split("@")[0];
  const arquivadas = estado === "arquivadas";
  const filtradas = useMemo(() => {
    const q = norm(search.trim());
    return (arquivadas ? arq : ativas).filter((d) =>
      (!q || norm([d.nome, d.fundadores, d.descricao, d.pais, d.origem?.nome, d.origem?.contacto, d.ref, d.proximaAcao].join(" ")).includes(q)) &&
      (arquivadas || ((!vez || d.vez === vez) && (!minhas || norm(d.responsavel || "").includes(norm(eu))) && (!atrasadas || prazoEstado(d) === "atrasado"))));
  }, [deals, arquivadas, search, vez, minhas, atrasadas, eu]); // eslint-disable-line react-hooks/exhaustive-deps
  const origens = useMemo(() => Array.from(new Set(deals.map((d) => d.origem?.nome).filter(Boolean))).sort(), [deals]);
  const pessoas = useMemo(() => Array.from(new Set([email, ...deals.map((d) => d.responsavel).filter(Boolean)])).sort(), [deals, email]);
  const late = ativas.filter((d) => prazoEstado(d) === "atrasado").length;
  const open = deals.find((d) => d.id === openId);

  const exportar = () => {
    const blob = new Blob([dealsCsv(deals)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `pipeline-sogrape-ventures-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (<>
    <div className="head">
      <div><h1>Pipeline</h1><p>O seguimento das startups da Sogrape Ventures, do primeiro contacto ao investimento. Só os administradores veem esta página.</p></div>
    </div>
    <div className="toolbar">
      <div className="seg" role="group" aria-label="Estado">
        <button aria-pressed={!arquivadas} onClick={() => setEstado("ativas")}>Em curso<span className="sc">{ativas.length}</span></button>
        <button aria-pressed={arquivadas} onClick={() => setEstado("arquivadas")}>Arquivadas<span className="sc">{arq.length}</span></button>
      </div>
      {!arquivadas && <>
        <div className="seg" role="group" aria-label="De quem é a vez">
          <button aria-pressed={!vez} onClick={() => setVez("")}>Todas as vezes</button>
          {VEZES.map((v) => <button key={v.id} aria-pressed={vez === v.id} onClick={() => setVez(vez === v.id ? "" : v.id)}>{v.curto}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Filtros">
          <button aria-pressed={minhas} onClick={() => setMinhas(!minhas)}><Icon name="users" />As minhas</button>
          <button aria-pressed={atrasadas} onClick={() => setAtrasadas(!atrasadas)} disabled={!late && !atrasadas}><Icon name="clock" />Atrasadas{late ? <span className="sc warn">{late}</span> : null}</button>
        </div>
      </>}
      <span className="sp" />
      <button className="btn" onClick={exportar} disabled={!deals.length}><Icon name="download-simple" />Exportar</button>
      {!arquivadas && <div className="seg" role="group" aria-label="Vista">
        <button aria-pressed={vista === "quadro"} onClick={() => setVista("quadro")} title="Quadro"><Icon name="kanban" />Quadro</button>
        <button aria-pressed={vista === "lista"} onClick={() => setVista("lista")} title="Lista"><Icon name="list-bullets" />Lista</button>
      </div>}
    </div>
    {!loaded ? <div className="loading">A carregar…</div>
      : erro ? <Empty title="Sem acesso ao pipeline" text={erro} />
      : !deals.length ? <Empty title="O pipeline está vazio" text="Para começar o seguimento de uma startup, abre-a na Triagem ou nas Aprovadas e carrega em «Pôr no pipeline»." />
      : !arquivadas && vista === "calendario" ? <PipelineCalendar deals={filtradas} onOpen={setOpenId} />
      : !arquivadas && vista === "quadro" ? <PipelineBoard deals={filtradas} onOpen={setOpenId} notify={flash} />
      : !filtradas.length ? <Empty title="Nada encontrado" text="Muda a pesquisa ou os filtros." />
      : <PipelineTable key={`${estado}-${vista}`} deals={filtradas} arquivadas={arquivadas} onOpen={setOpenId} />}
    {open && <DealDrawer d={open} list={filtradas} origens={origens} pessoas={pessoas} onClose={() => setOpenId(null)} onNav={setOpenId} notify={flash} />}
    {el}
  </>);
}
