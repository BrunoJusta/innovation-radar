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

/** Secção Startups do backoffice: duas páginas, Triagem e Radar. */
export function StartupsSection() {
  const { canPipeline } = useSession();
  const [page, setPage] = useState<Status | "radar" | "pipeline">("pending");
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
  const cnt = (st: Status) => startups.filter((s) => s.status === st).length;
  const TABS: { id: Status; label: string; icon: string }[] = [
    { id: "pending", label: "Triagem", icon: "tray" }, { id: "approved", label: "Aprovadas", icon: "check-circle" }, { id: "rejected", label: "Rejeitadas", icon: "prohibit" },
  ];
  return (<DealsLookup>
    <div className="pagebar">
      <nav className="subnav" aria-label="Startups">
        {TABS.map((t) => (
          <button key={t.id} aria-current={page === t.id} onClick={() => setPage(t.id)}><Icon name={t.icon} />{t.label}
            {cnt(t.id) > 0 && <span className={t.id === "pending" ? "c" : "c soft"}>{cnt(t.id)}</span>}</button>
        ))}
        <button aria-current={page === "radar"} onClick={() => setPage("radar")}><Icon name="globe" />Radar</button>
        {canPipeline && <button aria-current={page === "pipeline"} onClick={() => setPage("pipeline")}><Icon name="kanban" />Pipeline<PipeCount /></button>}
      </nav>
      {page !== "radar" && (
        <div className="pageact">
          <SearchField value={search} onChange={setSearch} placeholder={page === "pipeline" ? "Pesquisar no pipeline" : "Pesquisar startups"} />
          {page !== "pipeline" && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Adicionar startups</button>}
        </div>
      )}
    </div>
    {page === "pipeline" ? <PipelineSection search={search} /> : page !== "radar" ? <StartupsTriage status={page as Status} onStatus={setPage} startups={startups} sectors={sectors} loaded={loaded} search={search} adding={adding} setAdding={setAdding} /> : <StartupRadar startups={startups} sectors={sectors} loaded={loaded} />}
  </DealsLookup>);
}

/** Número de startups em curso no pipeline (no separador). */
function PipeCount() {
  const { deals } = useDeals();
  const n = deals.filter((d) => d.etapa !== "arquivada").length;
  return n ? <span className="c soft">{n}</span> : null;
}
