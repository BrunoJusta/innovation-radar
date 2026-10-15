"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sector, Startup, Status } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { StartupsTriage } from "./StartupsTriage";
import { StartupRadar } from "./StartupRadar";
import { SearchField } from "../ui";
import { DealsLookup, useDeals } from "../pipeline/DealsLookup";
import { PipelineSection } from "../pipeline/PipelineSection";
import { useSession } from "../AuthGate";

/** Secção Startups do backoffice: Triagem, Aprovadas, Rejeitadas, Radar e (admins) Pipeline. */
type Page = Status | "radar" | "pipeline";
export function StartupsSection({ initial = "pending" }: { initial?: Page }) {
  return <DealsLookup><Section initial={initial} /></DealsLookup>;
}

function Section({ initial }: { initial: Page }) {
  const { deals } = useDeals();
  const { canPipeline } = useSession();
  const [page, setPage] = useState<Page>(initial === "pipeline" && !canPipeline ? "approved" : initial);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const u1 = onSnapshot(collection(db, "startups"), (s) => { setStartups(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Startup)); setLoaded(true); },
      (e) => { console.error(e); setLoaded(true); });
    const u2 = onSnapshot(query(collection(db, "sectors"), orderBy("ordem")), (s) => setSectors(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Sector)));
    return () => { u1(); u2(); };
  }, []);
  // As aprovadas que passaram para o pipeline saem da lista de Aprovadas (continuam aprovadas na base de dados e no radar)
  const noPipe = new Set(deals.map((d) => d.startupId).filter(Boolean));
  const lista = startups.filter((s) => !(s.status === "approved" && (s.dealId || noPipe.has(s.id))));
  const cnt = (st: Status) => lista.filter((s) => s.status === st).length;
  const TABS: { id: Status; label: string; icon: string }[] = [
    { id: "pending", label: "Triagem", icon: "tray" }, { id: "approved", label: "Aprovadas", icon: "check-circle" }, { id: "rejected", label: "Arquivo", icon: "prohibit" },
  ];
  const Tab = ({ t }: { t: (typeof TABS)[number] }) => (
    <button key={t.id} aria-current={page === t.id} onClick={() => setPage(t.id)}><Icon name={t.icon} />{t.label}
      {cnt(t.id) > 0 && <span className={t.id === "pending" ? "c" : "c soft"}>{cnt(t.id)}</span>}</button>
  );
  return (<>
    <div className="pagebar">
      <nav className="subnav" aria-label="Startups">
        {TABS.slice(0, 2).map((t) => Tab({ t }))}
        {canPipeline && <button aria-current={page === "pipeline"} onClick={() => setPage("pipeline")}><Icon name="kanban" />Pipeline<PipeCount /></button>}
        {TABS.slice(2).map((t) => Tab({ t }))}
        <button aria-current={page === "radar"} onClick={() => setPage("radar")}><Icon name="globe" />Radar</button>
      </nav>
      {page !== "radar" && (
        <div className="pageact">
          <SearchField value={search} onChange={setSearch} placeholder={page === "pipeline" ? "Pesquisar no pipeline" : "Pesquisar startups"} />
          {page !== "pipeline" && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Adicionar startups</button>}
        </div>
      )}
    </div>
    {page === "pipeline" ? <PipelineSection search={search} /> : page !== "radar" ? <StartupsTriage status={page as Status} onStatus={setPage} startups={lista} sectors={sectors} loaded={loaded} search={search} adding={adding} setAdding={setAdding} /> : <StartupRadar startups={startups} sectors={sectors} loaded={loaded} />}
  </>);
}

/** Número de startups em curso no pipeline (no separador). */
function PipeCount() {
  const { deals } = useDeals();
  const n = deals.filter((d) => d.etapa !== "arquivada").length;
  return n ? <span className="c soft">{n}</span> : null;
}
