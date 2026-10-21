"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Area, Category, Fila, Signal } from "@/lib/types";
import { logout, useSession } from "./AuthGate";
import { SignalsView } from "./SignalsView";
import { SettingsHub } from "./admin/SettingsHub";
import { useFlash } from "./admin/common";
import { AddByLink } from "./AddByLink";
import { StartupsSection } from "./startups/StartupsSection";
import { SearchField } from "./ui";
import { AnaliseQueueProvider } from "./AnaliseQueue";
import RadarApp from "@/components/radar/RadarApp";
import { Dashboard, DashGo } from "./dashboard/Dashboard";
import { Icon } from "@/components/Icon";
import { podeInovacao } from "@/lib/inovacao";
import { ProjetosView } from "./inovacao/ProjetosView";
import { EventosView } from "./inovacao/EventosView";

type View = "dashboard" | "news" | "startups" | "projetos" | "eventos" | "settings";
const NEWS: { id: Fila; label: string; icon: string }[] = [
  { id: "pending", label: "Triagem", icon: "tray" }, { id: "approved", label: "Aprovadas", icon: "check-circle" },
];

export function Backoffice({ onQuick }: { onQuick?: () => void } = {}) {
  const { isAdmin, profile, email } = useSession();
  /** Projetos e eventos: por agora só para o Bruno. */
  const inov = podeInovacao(email);
  const [view, setView] = useState<View>("dashboard");
  const [sPage, setSPage] = useState<{ p: Fila | "radar" | "pipeline"; k: number }>({ p: "pending", k: 0 });
  const go = (g: DashGo) => { if (g.view === "news") { setSt(g.st); setView("news"); } else { setSPage({ p: g.page, k: Date.now() }); setView("startups"); } window.scrollTo(0, 0); };
  const [st, setSt] = useState<Fila | "radar">("pending");
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
  }), [signals]);

  const isSignals = view === "news";

  return (
    <AnaliseQueueProvider notify={flash}>
    <div className="bo-app">
      <header className="top">
        <div className="wrap topin">
          <a className="brand" href="/" title="Abrir o radar"><b>Inovação</b></a>
          <nav className="tabs" aria-label="Secções">
            <button aria-current={view === "dashboard"} onClick={() => setView("dashboard")}><span className="l">Dashboard</span></button>
            <button aria-current={view === "news"} onClick={() => setView("news")}><span className="l">Notícias</span>{counts.pending > 0 && <span className="c">{counts.pending}</span>}</button>
            <button aria-current={view === "startups"} onClick={() => setView("startups")}><span className="l">Startups</span></button>
            {inov && <button aria-current={view === "projetos"} onClick={() => setView("projetos")}><span className="l">Projetos</span></button>}
            {inov && <button aria-current={view === "eventos"} onClick={() => setView("eventos")}><span className="l">Eventos</span></button>}
            {isAdmin && <button aria-current={view === "settings"} onClick={() => setView("settings")}><span className="l">Definições</span></button>}
          </nav>
          <span className="sp" />
          <div className="who-me" title={email}>
            <span>{profile.nome || email.split("@")[0]}</span><small>{profile.role === "admin" ? "Admin" : "Editor"}</small>
          </div>
          {onQuick && <button className="btn icon" title="Vista rápida" aria-label="Abrir a vista rápida" onClick={onQuick}><Icon name="device-mobile" /></button>}
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
              <button aria-current={st === "radar"} onClick={() => setSt("radar")}><Icon name="globe" />Radar</button>
            </nav>
            {st === "radar" ? <div className="pageact"><a className="btn" href="/" target="_blank" rel="noopener noreferrer"><Icon name="arrow-up-right" />Abrir o site</a></div> : <div className="pageact">
              <SearchField value={search} onChange={setSearch} placeholder="Pesquisar notícias" />
              <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Adicionar por link</button>
            </div>}
          </div>
        )}
        {isSignals && st === "radar" && <RadarApp inBo />}
        {isSignals && st !== "radar" && <SignalsView status={st} signals={signals} areas={areas} cats={cats} loaded={loaded} search={search} />}
        {view === "dashboard" && <Dashboard signals={signals} areas={areas} go={go} />}
        {view === "startups" && <StartupsSection key={sPage.k} initial={sPage.p} />}
        {view === "projetos" && inov && <ProjetosView />}
        {view === "eventos" && inov && <EventosView />}
        {view === "settings" && isAdmin && <SettingsHub areas={areas} cats={cats} />}
      </main>
      {adding && <AddByLink areas={areas} cats={cats} signals={signals} onClose={() => setAdding(false)}
        onDone={(msg, aprovada) => { setAdding(false); setView("news"); setSt(aprovada ? "approved" : "pending"); flash(msg); }} />}
      {flashEl}
    </div>
    </AnaliseQueueProvider>
  );
}
