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
import { Icon } from "@/components/Icon";

type View = Status | "settings";
const MAIN: { id: Status; label: string }[] = [
  { id: "pending", label: "Triagem" }, { id: "approved", label: "Aprovadas" }, { id: "rejected", label: "Rejeitadas" },
];
const ADMIN: { id: View; label: string }[] = [{ id: "settings", label: "Definições" }];

export function Backoffice() {
  const { isAdmin, profile, email } = useSession();
  const [view, setView] = useState<View>("pending");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query_, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
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

  const isSignals = view === "pending" || view === "approved" || view === "rejected";

  return (
    <div className="bo-app">
      <header className="top">
        <div className="wrap topin">
          <a className="brand" href="/" title="Abrir o radar"><b>Radar de Inovação</b></a>
          <nav className="tabs" aria-label="Secções">
            {MAIN.map((v) => (
              <button key={v.id} aria-current={view === v.id} onClick={() => setView(v.id)}>
                <span className="l">{v.label}</span><span className="c">{counts[v.id]}</span>
              </button>
            ))}
            {isAdmin && ADMIN.map((v) => (
              <button key={v.id} aria-current={view === v.id} onClick={() => setView(v.id)}><span className="l">{v.label}</span></button>
            ))}
          </nav>
          <span className="sp" />
          {isSignals && (
            <label className={`searchbox${query_ ? " has" : ""}`}><Icon name="magnifying-glass" />
              <input type="search" placeholder="Pesquisar" aria-label="Pesquisar" value={query_} onChange={(e) => setQuery(e.target.value)} />
            </label>
          )}
          <button className="btn primary addbtn" onClick={() => setAdding(true)}><Icon name="plus" /><span>Adicionar</span></button>
          <div className="who-me" title={email}>
            <span>{profile.nome || email.split("@")[0]}</span><small>{profile.role === "admin" ? "Admin" : "Editor"}</small>
          </div>
          <button className="btn icon" title="Sair" aria-label="Sair" onClick={() => logout()}><Icon name="sign-out" /></button>
        </div>
      </header>
      <main className="wrap" id="main">
        {isSignals && <SignalsView status={view as Status} signals={signals} areas={areas} cats={cats} loaded={loaded} search={query_} />}
        {view === "settings" && isAdmin && <SettingsHub areas={areas} cats={cats} />}
      </main>
      {adding && <AddByLink areas={areas} cats={cats} signals={signals} onClose={() => setAdding(false)}
        onDone={(msg, aprovada) => { setAdding(false); setView(aprovada ? "approved" : "pending"); flash(msg); }} />}
      {flashEl}
    </div>
  );
}
