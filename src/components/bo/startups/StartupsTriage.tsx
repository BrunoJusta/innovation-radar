"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { approveStartup, rejectStartup, restoreStartup, SSnapshot, startupBackToTriage, toggleStartupStar } from "@/lib/startup-actions";
import { FASES, Sector, Startup, Status } from "@/lib/types";
import { fdCurto, relLevel } from "@/lib/util";
import { useSession } from "../AuthGate";
import { Empty, Gauge } from "../ui";
import { SREJECT, StartupDrawer } from "./StartupDrawer";
import { FindStartups } from "./FindStartups";

const ST: { id: Status; label: string }[] = [{ id: "pending", label: "Por decidir" }, { id: "approved", label: "Aprovadas" }, { id: "rejected", label: "Rejeitadas" }];

export function StartupsTriage({ startups, sectors, loaded, search }: { startups: Startup[]; sectors: Sector[]; loaded: boolean; search: string }) {
  const { email } = useSession();
  const [status, setStatus] = useState<Status>("pending");
  const [fSec, setFSec] = useState("all");
  const [fFase, setFFase] = useState("all");
  const [sort, setSort] = useState<"score" | "date">("score");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectCard, setRejectCard] = useState<string | null>(null);
  const [finding, setFinding] = useState<null | "search" | "site">(null);
  const [toast, setToast] = useState<{ msg: string; undo?: SSnapshot } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = (msg: string, undo?: SSnapshot) => { setToast({ msg, undo }); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 5000); };
  useEffect(() => { setOpenId(null); setRejectCard(null); }, [status]);

  const sec = (id: string) => sectors.find((x) => x.id === id);
  const counts = useMemo(() => Object.fromEntries(ST.map((x) => [x.id, startups.filter((s) => s.status === x.id).length])) as Record<Status, number>, [startups]);
  const list = useMemo(() => {
    let l = startups.filter((s) => s.status === status);
    if (fSec !== "all") l = l.filter((s) => s.setor === fSec);
    if (fFase !== "all") l = l.filter((s) => s.fase === fFase);
    if (search) { const q = search.toLowerCase(); l = l.filter((s) => `${s.nome} ${s.dominio} ${s.descricao} ${s.pais} ${(s.investidores || []).join(" ")}`.toLowerCase().includes(q)); }
    return [...l].sort((a, b) => sort === "date" ? b.criadoEm.localeCompare(a.criadoEm) : (Number(!!b.destaque) - Number(!!a.destaque)) || b.relevancia - a.relevancia);
  }, [startups, status, fSec, fFase, search, sort]);

  const act = async (p: Promise<SSnapshot>, msg: string, next?: boolean) => {
    const i = list.findIndex((x) => x.id === openId);
    try { const snap = await p; notify(msg, snap); if (next && openId) setOpenId(list[i + 1]?.id || list[i - 1]?.id || null); }
    catch { notify("Não foi possível guardar. Tenta outra vez."); }
  };
  const open = openId ? startups.find((x) => x.id === openId) || null : null;

  return (<>
    <div className="head">
      <div><h1>Startups</h1><p>Startups encontradas na pesquisa semanal, nas notícias e à mão. As aprovadas entram no radar de startups.</p></div>
      <div className="adm-act">
        <button className="btn" onClick={() => setFinding("site")}><Icon name="plus" />Adicionar por site</button>
        <button className="btn primary" onClick={() => setFinding("search")}><Icon name="magnifying-glass" />Procurar online</button>
      </div>
    </div>
    <div className="toolbar">
      <div className="seg" role="group" aria-label="Estado">
        {ST.map((x) => <button key={x.id} aria-pressed={status === x.id} onClick={() => setStatus(x.id)}>{x.label}<span className="segc">{counts[x.id]}</span></button>)}
      </div>
      <div className="seg" role="group" aria-label="Setor">
        <button aria-pressed={fSec === "all"} onClick={() => setFSec("all")}>Todos os setores</button>
        {sectors.map((s) => <button key={s.id} aria-pressed={fSec === s.id} onClick={() => setFSec(s.id)}><Icon name={s.icone} />{s.nome}</button>)}
      </div>
      <div className="seg" role="group" aria-label="Fase">
        <button aria-pressed={fFase === "all"} onClick={() => setFFase("all")}>Todas as fases</button>
        {[...FASES].reverse().map((f) => <button key={f.id} aria-pressed={fFase === f.id} onClick={() => setFFase(f.id)}>{f.nome}</button>)}
      </div>
      <div className="seg" role="group" aria-label="Ordenar">
        <button aria-pressed={sort === "score"} onClick={() => setSort("score")}>Relevância</button>
        <button aria-pressed={sort === "date"} onClick={() => setSort("date")}>Recentes</button>
      </div>
    </div>

    {!loaded ? <div className="loading">A carregar…</div> : list.length === 0 ? (
      startups.length === 0
        ? <Empty icon={<Icon name="rss" size={22} />} title="Ainda sem startups" text="A recolha semanal corre à segunda de manhã. Também podes procurar online ou adicionar uma startup pelo site." />
        : <Empty icon={<Icon name="magnifying-glass" size={22} />} title="Nada por aqui" text="Nenhuma startup corresponde a este estado ou filtro." />
    ) : (
      <div className="grid">
        {list.map((s) => {
          const c = sec(s.setor), fase = FASES.find((f) => f.id === s.fase), lv = relLevel(s.relevancia);
          return (
            <article key={s.id} className={`card scard${s.destaque ? " star" : ""}`} style={{ ["--c" as string]: c?.cor || "var(--ink-tertiary)" }} data-lv={lv}>
              <div className="cbody" role="button" tabIndex={0} aria-label={`Abrir ${s.nome}`} onClick={() => setOpenId(s.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(s.id); } }}>
                <div className="ctopg">
                  <div className="tags">
                    <span className="tg ar">{c?.nome || "Sem setor"}</span>
                    <span className="tg">{fase?.nome}</span>
                    {s.destaque && <span className="tg star"><Icon name="star-fill" />Destaque</span>}
                    {s.status === "rejected" && <span className="tg no">{s.motivoRejeicao}</span>}
                  </div>
                  <Gauge v={s.relevancia} />
                </div>
                <div className="sname"><span className="slogo">{s.nome.slice(0, 1).toUpperCase()}</span><div><h3>{s.nome}</h3><span className="sdom">{s.dominio}</span></div></div>
                <p className="snip">{s.descricao}</p>
                <div className="cfoot">
                  <span>{[s.pais, s.fundacao ? `fundada em ${s.fundacao}` : ""].filter(Boolean).join(", ") || "Sem dados de país"}</span>
                  <span className="sp" /><span title="Quando entrou">{fdCurto(s.criadoEm)}</span>
                </div>
              </div>
              {s.status === "pending" ? (rejectCard === s.id ? (
                <div className="reasons"><div className="rh">Porque rejeitas?<button className="txtbtn" onClick={() => setRejectCard(null)}>Cancelar</button></div>
                  <div className="rgrid">{SREJECT.map((m) => <button key={m} onClick={() => { setRejectCard(null); act(rejectStartup(s, m), `«${s.nome}» rejeitada`); }}>{m}</button>)}</div></div>
              ) : (
                <div className="cact">
                  <button className="btn primary" onClick={() => act(approveStartup(s, email), `«${s.nome}» aprovada e no radar`)}><Icon name="check" />Aprovar</button>
                  <button className="btn" onClick={() => setRejectCard(s.id)}><Icon name="x" />Rejeitar</button><span className="sp" />
                  <button className="btn icon" aria-pressed={!!s.destaque} title="Destacar" onClick={() => toggleStartupStar(s)}><Icon name={s.destaque ? "star-fill" : "star"} /></button>
                </div>
              )) : (
                <div className="cact">
                  <button className="btn" onClick={() => act(startupBackToTriage(s), `«${s.nome}» voltou à triagem`)}><Icon name="arrow-u-up-left" />Voltar à triagem</button><span className="sp" />
                  {s.status === "approved" && <button className="btn icon" aria-pressed={!!s.destaque} title="Destacar" onClick={() => toggleStartupStar(s)}><Icon name={s.destaque ? "star-fill" : "star"} /></button>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    )}

    {open && (
      <StartupDrawer s={open} list={list} sectors={sectors} onClose={() => setOpenId(null)} onNav={setOpenId} notify={(m) => notify(m)}
        onApprove={() => act(approveStartup(open, email), `«${open.nome}» aprovada e no radar`, true)}
        onReason={(m) => act(rejectStartup(open, m), `«${open.nome}» rejeitada`, true)}
        onStar={() => toggleStartupStar(open)} onBack={() => act(startupBackToTriage(open), `«${open.nome}» voltou à triagem`, true)} />
    )}
    {finding && <FindStartups mode={finding} sectors={sectors} startups={startups} onClose={() => setFinding(null)}
      onDone={(msg) => { setFinding(null); setStatus("pending"); notify(msg); }} />}
    {toast && (
      <div className="toast" role="status"><span>{toast.msg}</span>
        {toast.undo && <button className="btn" onClick={() => { restoreStartup(toast.undo!).then(() => notify("Anulado")); }}><Icon name="arrow-counter-clockwise" />Anular</button>}
      </div>
    )}
  </>);
}
