"use client";
import { useMemo, useState } from "react";
import { layout, RadarChart } from "@/components/radar/RadarChart";
import { approveStartup, rejectStartup, startupBackToTriage, toggleStartupStar } from "@/lib/startup-actions";
import { FASES, Sector, Startup } from "@/lib/types";
import { useSession } from "../AuthGate";
import { StartupDrawer } from "./StartupDrawer";

/** Radar das startups aprovadas: anéis = setores (pela ordem definida), cor = setor; a fase é um filtro. */
export function StartupRadar({ startups, sectors, loaded }: { startups: Startup[]; sectors: Sector[]; loaded: boolean }) {
  const { email } = useSession();
  const [fRing, setFRing] = useState<string | null>(null);
  const [fFase, setFFase] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const rings = useMemo(() => sectors.map((x) => ({ id: x.id, nome: x.nome, cor: x.cor })), [sectors]);
  const approved = useMemo(() => startups.filter((s) => s.status === "approved"), [startups]);
  const items = useMemo(() => layout(rings, approved.map((s) => {
    const sec = sectors.find((x) => x.id === s.setor), fase = FASES.find((f) => f.id === s.fase);
    return { id: s.id, ring: s.setor, group: s.fase, color: sec?.cor || "#94A3B8", titulo: s.nome, sub: `${sec?.nome || ""}, ${fase?.nome || ""}`, relevancia: s.relevancia + (s.destaque ? 100 : 0) };
  })), [approved, sectors, rings]);
  const counts = (rid: string) => items.filter((x) => x.ring === rid && (fFase === "all" || x.group === fFase)).length;
  const open = openId ? startups.find((s) => s.id === openId) || null : null;
  const list = items.map((x) => startups.find((s) => s.id === x.id)!).filter(Boolean);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  return (<>
    <div className="rp rp-embed">
      <section className="hero" aria-label="Radar de startups">
        <div className="htxt">
          <h1>Radar de startups</h1>
          <p className="sub">Startups aprovadas pela equipa de Inovação, organizadas por setor. Filtra pela fase para ver só as que estão no momento certo para a Sogrape.</p>
        </div>
        <div className="hleg">
          <div className={`legend${fRing ? " filtering" : ""}`} role="group" aria-label="Filtrar por setor">
            {sectors.map((a) => (
              <button key={a.id} className="lg" style={{ ["--c" as string]: a.cor }} aria-pressed={fRing === a.id} onClick={() => setFRing(fRing === a.id ? null : a.id)}>
                <span className="sw" /><b>{a.nome}</b><span className="n">{counts(a.id)}</span><span className="d">{a.descricao}</span>
              </button>
            ))}
          </div>
          <div className="cats" role="group" aria-label="Filtrar por fase">
            <button className="chip" aria-pressed={fFase === "all"} onClick={() => setFFase("all")}>Todas as fases</button>
            {[...FASES].reverse().map((f) => (
              <button key={f.id} className="chip" aria-pressed={fFase === f.id} onClick={() => setFFase(f.id)} style={{ ["--sc" as string]: f.cor }}>
                <span className="scdot" />{f.nome}</button>
            ))}
          </div>
        </div>
        <RadarChart rings={rings} items={items} fRing={fRing} fGroup={fFase} regrowKey="" onOpen={setOpenId} state={loaded ? "ok" : "loading"} idPrefix="s"
          emptyTitle="Ainda sem startups aprovadas" emptyText="Aprova startups na triagem e elas aparecem aqui." ariaLabel="Radar das startups aprovadas" />
      </section>
    </div>
    {open && (
      <StartupDrawer s={open} list={list} sectors={sectors} onClose={() => setOpenId(null)} onNav={setOpenId} notify={flash}
        onApprove={() => approveStartup(open, email).then(() => flash("Aprovada"))}
        onReason={(m) => rejectStartup(open, m).then(() => { setOpenId(null); flash("Rejeitada"); })}
        onStar={() => toggleStartupStar(open)} onBack={() => startupBackToTriage(open).then(() => { setOpenId(null); flash(`«${open.nome}» voltou à triagem`); })} />
    )}
    {msg && <div className="toast" role="status"><span>{msg}</span></div>}
  </>);
}
