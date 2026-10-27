"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ProjetosView } from "./inovacao/ProjetosView";
import { EventosView } from "./inovacao/EventosView";
import { GlobalSearch } from "./GlobalSearch";
import { Loc, View, crumbsDe, mesmaLoc, normLoc } from "@/lib/localizacao";
const NEWS: { id: Fila; label: string; icon: string }[] = [
  { id: "pending", label: "Triagem", icon: "tray" }, { id: "approved", label: "Aprovadas", icon: "check-circle" },
];

export function Backoffice({ onQuick }: { onQuick?: () => void } = {}) {
  const { isAdmin, profile, email } = useSession();
  /** Projetos e eventos: visíveis para toda a equipa. */
  const inov = true;
  // Página atual. Cada mudança fica no histórico do browser, para as setas (e o botão de voltar do browser) funcionarem
  const [loc, setLocS] = useState<Loc>({ view: "dashboard" });
  /** Muda quando se volta atrás ou se abre um resultado da pesquisa: as secções voltam a montar com a página pedida. */
  const [k, setK] = useState(0);
  const pos = useRef({ i: 0, max: 0 });
  const [hist, setHist] = useState({ back: false, fwd: false });
  const syncHist = () => setHist({ back: pos.current.i > 0, fwd: pos.current.i < pos.current.max });
  useEffect(() => {
    try { history.replaceState({ ...(history.state || {}), bo: { loc: { view: "dashboard" }, i: 0 } }, ""); } catch { /* sem histórico */ }
    const onPop = (e: PopStateEvent) => {
      const b = (e.state as { bo?: { loc: Loc; i: number } } | null)?.bo;
      if (!b) return;
      pos.current.i = b.i; syncHist();
      setLocS(b.loc); setK((x) => x + 1); window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const locRef = useRef(loc); locRef.current = loc;
  /**
   * Vai para uma página. remount: as secções começam de novo nessa página (menus, pesquisa global, breadcrumbs);
   * sem remount, só regista a mudança que a própria secção já fez (um separador, por exemplo).
   */
  const nav = useCallback((l0: Loc, remount = true) => {
    const l = normLoc(l0);
    if (mesmaLoc(l, locRef.current)) { if (remount && l.foco) setK((x) => x + 1); return; }
    pos.current.i += 1; pos.current.max = pos.current.i; syncHist();
    try { history.pushState({ bo: { loc: l, i: pos.current.i } }, ""); } catch { /* sem histórico */ }
    setLocS(l);
    if (remount) { setK((x) => x + 1); window.scrollTo(0, 0); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const view: View = loc.view;
  const setView = (v: View) => nav({ view: v });
  const st = loc.news || "pending";
  const setSt = (n: Fila | "radar") => nav({ view: "news", news: n });
  const go = (g: DashGo) => { if (g.view === "news") nav({ view: "news", news: g.st }); else if (g.view === "projetos" || g.view === "eventos") nav({ view: g.view }); else nav({ view: "startups", st: g.page }); };
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
            <button title="Dashboard" aria-current={view === "dashboard"} onClick={() => setView("dashboard")}><Icon name="squares-four" /><span className="l">Dashboard</span></button>
            {inov && <button title="Projetos" aria-current={view === "projetos"} onClick={() => setView("projetos")}><Icon name="target" /><span className="l">Projetos</span></button>}
            <button title="Startups" aria-current={view === "startups"} onClick={() => setView("startups")}><Icon name="lightbulb" /><span className="l">Startups</span></button>
            {inov && <button title="Eventos" aria-current={view === "eventos"} onClick={() => setView("eventos")}><Icon name="calendar-blank" /><span className="l">Eventos</span></button>}
            <button title="Notícias" aria-current={view === "news"} onClick={() => setView("news")}><Icon name="rss" /><span className="l">Notícias</span>{counts.pending > 0 && <span className="c">{counts.pending}</span>}</button>
            {isAdmin && <button title="Definições" aria-current={view === "settings"} onClick={() => setView("settings")}><Icon name="gear" /><span className="l">Definições</span></button>}
          </nav>
          <span className="sp" />
          <GlobalSearch onGo={nav} />
          <div className="who-me" title={email}>
            <span>{profile.nome || email.split("@")[0]}</span><small>{profile.role === "admin" ? "Admin" : "Editor"}</small>
          </div>
          {onQuick && <button className="btn icon" title="Vista rápida" aria-label="Abrir a vista rápida" onClick={onQuick}><Icon name="device-mobile" /></button>}
          <button className="btn icon" title="Sair" aria-label="Sair" onClick={() => logout()}><Icon name="sign-out" /></button>
        </div>
      </header>
      <main className="wrap" id="main">
        <Crumbs loc={loc} back={hist.back} fwd={hist.fwd} onGo={nav} />
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
        {view === "startups" && <StartupsSection key={k} loc={loc} onLoc={(p) => nav({ view: "startups", st: loc.st, pipe: loc.pipe, ...p }, false)} />}
        {view === "projetos" && inov && <div className="inv-pg"><ProjetosView key={k} tab0={loc.proj} foco={loc.foco} onTab={(t) => nav({ view: "projetos", proj: t }, false)} /></div>}
        {view === "eventos" && inov && <div className="inv-pg"><EventosView key={k} foco={loc.foco} /></div>}
        {view === "settings" && isAdmin && <SettingsHub areas={areas} cats={cats} />}
      </main>
      {adding && <AddByLink areas={areas} cats={cats} signals={signals} onClose={() => setAdding(false)}
        onDone={(msg, aprovada) => { setAdding(false); setSt(aprovada ? "approved" : "pending"); flash(msg); }} />}
      {flashEl}
    </div>
    </AnaliseQueueProvider>
  );
}

/** Setas de voltar e avançar (o histórico do browser) e o caminho até à página atual. */
function Crumbs({ loc, back, fwd, onGo }: { loc: Loc; back: boolean; fwd: boolean; onGo: (l: Loc) => void }) {
  const c = crumbsDe(loc);
  return (
    <div className="crumbs">
      <div className="crumbs-nav">
        <button className="btn icon" title="Voltar" aria-label="Voltar" disabled={!back} onClick={() => history.back()}><Icon name="arrow-left" /></button>
        <button className="btn icon" title="Avançar" aria-label="Avançar" disabled={!fwd} onClick={() => history.forward()}><Icon name="arrow-right" /></button>
      </div>
      <nav aria-label="Estás em"><ol>
        {c.map((x, i) => {
          const ultimo = i === c.length - 1;
          return <li key={i}>{i > 0 && <Icon name="caret-right" />}
            {ultimo || !x.to ? <span aria-current={ultimo ? "page" : undefined}>{x.label}</span> : <button onClick={() => onGo(x.to!)}>{x.label}</button>}</li>;
        })}
      </ol></nav>
    </div>
  );
}
