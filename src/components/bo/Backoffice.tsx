"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Area, Category, Signal, Status } from "@/lib/types";
import { logout, useSession } from "./AuthGate";
import { SignalsView } from "./SignalsView";
import { SettingsHub } from "./admin/SettingsHub";
import { useFlash } from "./admin/common";
import { AddByLink } from "./AddByLink";
import { StartupsSection } from "./startups/StartupsSection";
import { SearchField } from "./ui";
import { AnaliseQueueProvider } from "./AnaliseQueue";
import { Icon } from "@/components/Icon";

type View = "news" | "startups" | "settings";
const NEWS: { id: Status; label: string; icon: string }[] = [
  { id: "pending", label: "Triagem", icon: "tray" }, { id: "approved", label: "Aprovadas", icon: "check-circle" }, { id: "rejected", label: "Rejeitadas", icon: "prohibit" },
];

export function Backoffice() {
  const { isAdmin, profile, email } = useSession();
  const [view, setView] = useState<View>("news");
  const [st, setSt] = useState<Status>("pending");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const { flash, el: flashEl } = useFlash();

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "signals"), orderBy("criadoEm", "desc"), limit(500)), (s) => {
      setSignals(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Signal)); setLoaded(true);
    }, (e) => { console.error(e); setLoaded(true); });
    const u2 = onSnapshot(query(collection(db, "areas"), orderBy("ordem")), (s) => setAreas(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Area)));
    const u3 = onSnapshot(query(collection(db, "categories"), orderBy("ordem")), (s) => setCats(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)));
    return () => { u1(); u2(); u3(); };
  }, []);

  const counts = useMemo(() => ({
    pending: signals.filter((s) => s.status === "pending").length,
    approved: signals.filter((s) => s.status === "approved").length,
    rejected: signals.filter((s) => s.status === "rejected").length,
  }), [signals]);

  const isSignals = view === "news";

  return (
    <AnaliseQueueProvider notify={flash}>
    <div className="bo-app">
      <header className="top">
        <div className="wrap topin">
          <a className="brand" href="/" title="Abrir o radar"><b>Radar de Inovação</b></a>
          <nav className="tabs" aria-label="Secções">
            <button aria-current={view === "news"} onClick={() => setView("news")}><span className="l">Notícias</span>{counts.pending > 0 && <span className="c">{counts.pending}</span>}</button>
            <button aria-current={view === "startups"} onClick={() => setView("startups")}><span className="l">Startups</span></button>
            {isAdmin && <button aria-current={view === "settings"} onClick={() => setView("settings")}><span className="l">Definições</span></button>}
          </nav>
          <span className="sp" />
          <div className="who-me" title={email}>
            <span>{profile.nome || email.split("@")[0]}</span><small>{profile.role === "admin" ? "Admin" : "Editor"}</small>
          </div>
          <button className="btn icon" title="Sair" aria-label="Sair" onClick={() => logout()}><Icon name="sign-out" /></button>
        </div>
      </header>
      <main className="wrap" id="main">
        {isSignals && (
          <div className="pagebar">
            <nav className="subnav" aria-label="Notícias">
              {NEWS.map((v) => (
                <button key={v.id} aria-current={st === v.id} onClick={() => setSt(v.id)}><Icon name={v.icon} />{v.label}
                  {counts[v.id] > 0 && <span className={v.id === "pending" ? "c" : "c soft"}>{counts[v.id]}</span>}</button>
              ))}
            </nav>
            <div className="pageact">
              <SearchField value={search} onChange={setSearch} placeholder="Pesquisar notícias" />
              <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Adicionar por link</button>
            </div>
          </div>
        )}
        {isSignals && <SignalsView status={st} signals={signals} areas={areas} cats={cats} loaded={loaded} search={search} />}
        {view === "startups" && <StartupsSection />}
        {view === "settings" && isAdmin && <SettingsHub areas={areas} cats={cats} />}
      </main>
      {adding && <AddByLink areas={areas} cats={cats} signals={signals} onClose={() => setAdding(false)}
        onDone={(msg, aprovada) => { setAdding(false); setView("news"); setSt(aprovada ? "approved" : "pending"); flash(msg); }} />}
      {flashEl}
    </div>
    </AnaliseQueueProvider>
  );
}
