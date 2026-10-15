"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sector, Startup } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { StartupsTriage } from "./StartupsTriage";
import { StartupRadar } from "./StartupRadar";
import { SearchField } from "../ui";

/** Secção Startups do backoffice: duas páginas, Triagem e Radar. */
export function StartupsSection() {
  const [page, setPage] = useState<"triage" | "radar">("triage");
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
  const pend = startups.filter((s) => s.status === "pending").length;
  return (<>
    <div className="pagebar">
      <nav className="subnav" aria-label="Startups">
        <button aria-current={page === "triage"} onClick={() => setPage("triage")}><Icon name="tray" />Triagem{pend > 0 && <span className="c">{pend}</span>}</button>
        <button aria-current={page === "radar"} onClick={() => setPage("radar")}><Icon name="globe" />Radar</button>
      </nav>
      {page === "triage" && (
        <div className="pageact">
          <SearchField value={search} onChange={setSearch} placeholder="Pesquisar startups" />
          <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Adicionar startups</button>
        </div>
      )}
    </div>
    {page === "triage" ? <StartupsTriage startups={startups} sectors={sectors} loaded={loaded} search={search} adding={adding} setAdding={setAdding} /> : <StartupRadar startups={startups} sectors={sectors} loaded={loaded} />}
  </>);
}
