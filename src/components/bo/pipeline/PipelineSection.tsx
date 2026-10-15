"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dealsCsv } from "@/lib/deal-actions";
import { Deal, VEZES, Vez } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { useSession } from "../AuthGate";
import { useFlash } from "../admin/common";
import { Empty, SearchField } from "../ui";
import { PipelineBoard, prazoEstado } from "./PipelineBoard";
import { PipelineTable } from "./PipelineTable";
import { DealDrawer } from "./DealDrawer";
import { NewDeal } from "./NewDeal";

type Page = "ativas" | "arquivadas";
type Vista = "quadro" | "lista";
const VIEW_KEY = "radar.pipeline.vista";
const readView = (): Vista => { try { return localStorage.getItem(VIEW_KEY) === "lista" ? "lista" : "quadro"; } catch { return "quadro"; } };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pipeline da Sogrape Ventures: o seguimento das startups, do primeiro contacto ao investimento. */
export function PipelineSection() {
  const { email } = useSession();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [erro, setErro] = useState("");
  const [page, setPage] = useState<Page>("ativas");
  const [vista, setVistaS] = useState<Vista>("quadro");
  useEffect(() => setVistaS(readView()), []);
  const setVista = (v: Vista) => { setVistaS(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* sem armazenamento */ } };
  const [search, setSearch] = useState("");
  const [vez, setVez] = useState<Vez | "">("");
  const [minhas, setMinhas] = useState(false);
  const [atrasadas, setAtrasadas] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { flash, el } = useFlash();

  useEffect(() => onSnapshot(collection(db, "deals"), (s) => { setDeals(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Deal)); setLoaded(true); },
    (e) => { setErro((e as { code?: string }).code === "permission-denied" ? "O pipeline é só para administradores. Se és admin, publica as regras do Firestore atualizadas." : "Não foi possível carregar o pipeline."); setLoaded(true); }), []);

  const ativas = deals.filter((d) => d.etapa !== "arquivada"), arq = deals.filter((d) => d.etapa === "arquivada");
  const eu = email.split("@")[0];
  const filtradas = useMemo(() => {
    const q = norm(search.trim());
    return (page === "arquivadas" ? arq : ativas).filter((d) =>
      (!q || norm([d.nome, d.fundadores, d.descricao, d.pais, d.origem?.nome, d.origem?.contacto, d.ref, d.proximaAcao].join(" ")).includes(q)) &&
      (page === "arquivadas" || ((!vez || d.vez === vez) && (!minhas || norm(d.responsavel || "").includes(norm(eu))) && (!atrasadas || prazoEstado(d) === "atrasado"))));
  }, [deals, page, search, vez, minhas, atrasadas, eu]); // eslint-disable-line react-hooks/exhaustive-deps
  const origens = useMemo(() => Array.from(new Set(deals.map((d) => d.origem?.nome).filter(Boolean))).sort(), [deals]);
  const pessoas = useMemo(() => Array.from(new Set([email, ...deals.map((d) => d.responsavel).filter(Boolean)])).sort(), [deals, email]);
  const late = ativas.filter((d) => prazoEstado(d) === "atrasado").length;
  const open = deals.find((d) => d.id === openId);

  const exportar = () => {
    const blob = new Blob([dealsCsv(page === "arquivadas" ? arq : deals)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `pipeline-sogrape-ventures-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (<>
    <div className="pagebar">
      <nav className="subnav" aria-label="Pipeline">
        <button aria-current={page === "ativas"} onClick={() => setPage("ativas")}><Icon name="kanban" />Em curso<span className="c">{ativas.length}</span></button>
        <button aria-current={page === "arquivadas"} onClick={() => setPage("arquivadas")}><Icon name="prohibit" />Arquivadas<span className="c soft">{arq.length}</span></button>
      </nav>
      <div className="pageact">
        <SearchField value={search} onChange={setSearch} placeholder="Pesquisar no pipeline" />
        <button className="btn icon" title="Exportar para Excel (CSV)" aria-label="Exportar para Excel" onClick={exportar}><Icon name="download-simple" /></button>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Nova startup</button>
      </div>
    </div>
    {page !== "arquivadas" && (
      <div className="pfilters">
        <div className="seg" role="group" aria-label="De quem é a vez">
          <button aria-pressed={!vez} onClick={() => setVez("")}>Todas</button>
          {VEZES.map((v) => <button key={v.id} aria-pressed={vez === v.id} onClick={() => setVez(vez === v.id ? "" : v.id)}>{v.curto}</button>)}
        </div>
        <button className="chipf" aria-pressed={minhas} onClick={() => setMinhas(!minhas)}><Icon name="users" />As minhas</button>
        <button className={`chipf${late ? " warnf" : ""}`} aria-pressed={atrasadas} onClick={() => setAtrasadas(!atrasadas)} disabled={!late && !atrasadas}><Icon name="clock" />Atrasadas{late ? ` (${late})` : ""}</button>
        <span className="sp" />
        <div className="seg" role="group" aria-label="Vista">
          <button aria-pressed={vista === "quadro"} onClick={() => setVista("quadro")} title="Quadro"><Icon name="kanban" />Quadro</button>
          <button aria-pressed={vista === "lista"} onClick={() => setVista("lista")} title="Lista"><Icon name="list-bullets" />Lista</button>
        </div>
      </div>
    )}
    {!loaded ? <div className="loading">A carregar…</div>
      : erro ? <Empty title="Sem acesso ao pipeline" text={erro} />
      : !deals.length ? <Empty title="O pipeline está vazio" text="Põe uma startup no pipeline com «Nova startup», ou a partir da ficha de uma startup do radar com «Pôr no pipeline»." />
      : page === "ativas" && vista === "quadro" ? <PipelineBoard deals={filtradas} onOpen={setOpenId} notify={flash} />
      : !filtradas.length ? <Empty title="Nada encontrado" text="Muda a pesquisa ou os filtros." />
      : <PipelineTable key={`${page}-${vista}`} deals={filtradas} arquivadas={page === "arquivadas"} onOpen={setOpenId} />}
    {open && <DealDrawer d={open} list={filtradas} origens={origens} pessoas={pessoas} onClose={() => setOpenId(null)} onNav={setOpenId} notify={flash} />}
    {adding && <NewDeal deals={deals} origens={origens} onClose={() => setAdding(false)} onDone={(id, msg) => { setAdding(false); setOpenId(id); flash(msg); }} />}
    {el}
  </>);
}
