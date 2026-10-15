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
import { StartupsTable } from "./StartupsTable";
import { useDeals } from "../pipeline/DealsLookup";
import { nomeEtapa } from "@/lib/deal-actions";
import { AnaliseLoading } from "../AnaliseQueue";

const VIEW_KEY = "radar.startups.vista";
const readView = (): "cards" | "list" => { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards"; } catch { return "cards"; } };

const TITLES: Record<Status, [string, string]> = {
  pending: ["Triagem", "Startups encontradas na pesquisa semanal, nas notícias e à mão, à espera de decisão."],
  approved: ["Aprovadas", "Estas startups estão no radar de startups. Os destaques aparecem primeiro. As que passam para o Pipeline saem desta lista, mas continuam aprovadas e no radar."],
  rejected: ["Arquivo", "Startups rejeitadas. Ficam guardadas com o motivo e não voltam a ser propostas pela recolha."],
};

export function StartupsTriage({ status, onStatus, startups, sectors, loaded, search, adding, setAdding }: {
  status: Status; onStatus: (s: Status) => void; startups: Startup[]; sectors: Sector[]; loaded: boolean; search: string; adding: boolean; setAdding: (v: boolean) => void;
}) {
  const { email } = useSession();
  const { dealOf } = useDeals();
  const [fSec, setFSec] = useState("all");
  const [fFase, setFFase] = useState("all");
  const [sort, setSort] = useState<"score" | "date">("score");
  const [view, setViewS] = useState<"cards" | "list">("cards");
  useEffect(() => setViewS(readView()), []);
  const setView = (v: "cards" | "list") => { setViewS(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* sem armazenamento */ } };
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectCard, setRejectCard] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: SSnapshot } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = (msg: string, undo?: SSnapshot) => { setToast({ msg, undo }); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 5000); };
  useEffect(() => { setOpenId(null); setRejectCard(null); }, [status]);

  const sec = (id: string) => sectors.find((x) => x.id === id);
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
      <div><h1>{TITLES[status][0]}</h1><p>{TITLES[status][1]}</p></div>
    </div>
    <div className="toolbar">
      <div className="seg" role="group" aria-label="Setor">
        <button aria-pressed={fSec === "all"} onClick={() => setFSec("all")}>Todos os setores</button>
        {sectors.map((s) => <button key={s.id} aria-pressed={fSec === s.id} onClick={() => setFSec(s.id)}><Icon name={s.icone} />{s.nome}</button>)}
      </div>
      <div className="seg" role="group" aria-label="Fase">
        <button aria-pressed={fFase === "all"} onClick={() => setFFase("all")}>Todas as fases</button>
        {[...FASES].reverse().map((f) => <button key={f.id} aria-pressed={fFase === f.id} onClick={() => setFFase(f.id)}>{f.nome}</button>)}
      </div>
      {view === "cards" && <div className="seg" role="group" aria-label="Ordenar">
        <button aria-pressed={sort === "score"} onClick={() => setSort("score")}>Relevância</button>
        <button aria-pressed={sort === "date"} onClick={() => setSort("date")}>Recentes</button>
      </div>}
      <span className="sp" />
      <div className="seg" role="group" aria-label="Vista">
        <button aria-pressed={view === "cards"} onClick={() => setView("cards")} title="Cartões"><Icon name="squares-four" />Cartões</button>
        <button aria-pressed={view === "list"} onClick={() => setView("list")} title="Lista"><Icon name="list-bullets" />Lista</button>
      </div>
    </div>

    {!loaded ? <div className="loading">A carregar…</div> : list.length === 0 ? (
      startups.length === 0
        ? <Empty icon={<Icon name="rss" size={22} />} title="Ainda sem startups" text="A recolha semanal corre à segunda de manhã. Também podes usar Adicionar startups para procurar online ou indicar o site de uma startup." />
        : <Empty icon={<Icon name="magnifying-glass" size={22} />} title="Nada por aqui" text="Nenhuma startup corresponde a este estado ou filtro." />
    ) : view === "list" ? (
      <StartupsTable list={list} sectors={sectors} onOpen={setOpenId}
        onApprove={(s) => act(approveStartup(s, email), `«${s.nome}» aprovada e no radar`)}
        onReject={(s, m) => act(rejectStartup(s, m), `«${s.nome}» rejeitada`)}
        onStar={(s) => toggleStartupStar(s)} onBack={(s) => act(startupBackToTriage(s), `«${s.nome}» voltou à triagem`)}
        onBulk={async (ids, acao, motivo) => {
          const sel = startups.filter((s) => ids.includes(s.id));
          try {
            await Promise.all(sel.map((s) => acao === "approve" ? approveStartup(s, email) : acao === "reject" ? rejectStartup(s, motivo || "Pouco relevante") : startupBackToTriage(s)));
            notify(`${sel.length} startup${sel.length > 1 ? "s" : ""} ${acao === "approve" ? "aprovada" : acao === "reject" ? "rejeitada" : "de volta à triagem"}${sel.length > 1 ? "s" : ""}`);
          } catch { notify("Algumas não foram guardadas. Tenta outra vez."); }
        }} />
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
                    {dealOf(s) && <span className="tg pipe" title={`No pipeline: ${nomeEtapa(dealOf(s)!.etapa)}`}><Icon name="kanban" />{dealOf(s)!.etapa === "arquivada" ? "Arquivada no pipeline" : nomeEtapa(dealOf(s)!.etapa)}</span>}
                    <AnaliseLoading path={`startups/${s.id}`} short />
                    {s.analiseResumo && <span className={`anchip ${s.analiseResumo.decisao}`} title={`Análise de investimento: ${s.analiseResumo.positivos} de 11 critérios positivos`}><Icon name="scales" />{s.analiseResumo.decisao === "investir" ? "Investir" : "Não investir"}</span>}
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
    {adding && <FindStartups mode="search" sectors={sectors} startups={startups} onClose={() => setAdding(false)}
      onDone={(msg) => { setAdding(false); onStatus("pending"); notify(msg); }} />}
    {toast && (
      <div className="toast" role="status"><span>{toast.msg}</span>
        {toast.undo && <button className="btn" onClick={() => { restoreStartup(toast.undo!).then(() => notify("Anulado")); }}><Icon name="arrow-counter-clockwise" />Anular</button>}
      </div>
    )}
  </>);
}
