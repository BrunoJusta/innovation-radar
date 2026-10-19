"use client";
import { useEffect, useMemo, useState } from "react";
import { MOTIVOS_ARQUIVO, VEZES, Vez } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { useSession } from "../AuthGate";
import { useFlash } from "../admin/common";
import { Empty } from "../ui";
import { useDeals } from "./DealsLookup";
import { PipelineBoard, prazoEstado } from "./PipelineBoard";
import { PipelineTable } from "./PipelineTable";
import { DealDrawer } from "./DealDrawer";
import { PipelineCalendar } from "./PipelineCalendar";
import { AreaSelect, CatSelect, SectorSelect } from "@/components/CatSelect";
import { useAreas, useCategorias } from "@/lib/use-areas";
import type { Category } from "@/lib/types";

/** Motivos de arquivo no formato do dropdown. */
const MOT_OPC = MOTIVOS_ARQUIVO.map((m, i) => ({ id: m.id, nome: m.nome, icone: "prohibit", descricao: "", ordem: i, palavrasChave: [] })) as Category[];

/** Opções do filtro "de quem é a vez", no formato do dropdown das tags. */
const VEZ_OPC = VEZES.map((v, i) => ({ id: v.id, nome: v.nome, icone: ({ sogrape: "wine", startup: "lightbulb", beta: "briefcase", reuniao: "calendar-blank" } as Record<string, string>)[v.id] || "users", descricao: "", ordem: i, palavrasChave: [] })) as Category[];

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
  // Filtros do arquivo
  const areas = useAreas(), categorias = useCategorias();
  const [aCad, setACad] = useState("all");
  const [aCat, setACat] = useState("all");
  const [aMot, setAMot] = useState("all");
  const [aAno, setAAno] = useState("all");
  const { flash, el } = useFlash();

  const ativas = deals.filter((d) => d.etapa !== "arquivada"), arq = deals.filter((d) => d.etapa === "arquivada");
  const eu = email.split("@")[0];
  const arquivadas = estado === "arquivadas";
  const filtradas = useMemo(() => {
    const q = norm(search.trim());
    return (arquivadas ? arq : ativas).filter((d) =>
      (!q || norm([d.nome, d.fundadores, d.descricao, d.pais, d.origem?.nome, d.origem?.contacto, d.ref, d.proximaAcao].join(" ")).includes(q)) &&
      (!arquivadas || ((aCad === "all" || d.cadeia === aCad) && (aCat === "all" || d.categoria === aCat) && (aMot === "all" || d.arquivo?.motivo === aMot) && (aAno === "all" || (d.arquivo?.em || d.etapaDesde || "").startsWith(aAno)))) &&
      (arquivadas || ((!vez || d.vez === vez) && (!minhas || norm(d.responsavel || "").includes(norm(eu))) && (!atrasadas || prazoEstado(d) === "atrasado"))));
  }, [deals, arquivadas, search, vez, minhas, atrasadas, eu, aCad, aCat, aMot, aAno]); // eslint-disable-line react-hooks/exhaustive-deps
  const origens = useMemo(() => Array.from(new Set(deals.map((d) => d.origem?.nome).filter(Boolean))).sort(), [deals]);
  const pessoas = useMemo(() => Array.from(new Set([email, ...deals.map((d) => d.responsavel).filter(Boolean)])).sort(), [deals, email]);
  // Contagens de cada opção do arquivo, com os outros filtros aplicados
  const arqF = (sem: string) => arq.filter((d) => (sem === "cad" || aCad === "all" || d.cadeia === aCad) && (sem === "cat" || aCat === "all" || d.categoria === aCat)
    && (sem === "mot" || aMot === "all" || d.arquivo?.motivo === aMot) && (sem === "ano" || aAno === "all" || (d.arquivo?.em || d.etapaDesde || "").startsWith(aAno)));
  const anosArq = Array.from(new Set(arq.map((d) => (d.arquivo?.em || d.etapaDesde || "").slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))).sort().reverse();
  const late = ativas.filter((d) => prazoEstado(d) === "atrasado").length;
  const open = deals.find((d) => d.id === openId);

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
        <CatSelect cats={VEZ_OPC} value={vez || "all"} onChange={(id) => setVez(id === "all" ? "" : (id as Vez))} simples
          counts={(id) => ativas.filter((d) => d.vez === id).length} total={ativas.length} allLabel="Responsável: todos" procurar="Procurar" />
        <div className="seg" role="group" aria-label="Filtros">
          <button aria-pressed={minhas} onClick={() => setMinhas(!minhas)}><Icon name="users" />As minhas</button>
          <button aria-pressed={atrasadas} onClick={() => setAtrasadas(!atrasadas)} disabled={!late && !atrasadas}><Icon name="clock" />Atrasadas{late ? <span className="sc warn">{late}</span> : null}</button>
        </div>
      </>}
      {arquivadas && <>
        <AreaSelect areas={areas} value={aCad} onChange={setACad} counts={(id) => arqF("cad").filter((d) => d.cadeia === id).length} />
        <SectorSelect sectors={categorias} value={aCat} onChange={setACat} counts={(id) => arqF("cat").filter((d) => d.categoria === id).length} />
        <CatSelect cats={MOT_OPC} value={aMot} onChange={setAMot} simples counts={(id) => arqF("mot").filter((d) => d.arquivo?.motivo === id).length} total={arqF("mot").length} allLabel="Todos os motivos" procurar="Procurar motivo" />
        <label className={`fsel${aAno !== "all" ? " on" : ""}`}><select value={aAno} onChange={(e) => setAAno(e.target.value)} aria-label="Ano de arquivo">
          <option value="all">Todos os anos</option>{anosArq.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
      </>}
      <span className="sp" />
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
