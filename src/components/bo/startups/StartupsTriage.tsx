"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pager, usePaged } from "@/components/Pager";
import { Icon } from "@/components/Icon";
import { approveStartup, purgeStartup, rejectStartup, restoreStartup, SSnapshot, startupBackToTriage } from "@/lib/startup-actions";
import { agendarApagar, cancelarApagar } from "@/lib/purge";
import { Area, FASES, Fila, Sector, Startup, Status, nomeDecisao } from "@/lib/types";
import { AreaSelect, FaseSelect, SectorSelect } from "@/components/CatSelect";
import { fdCurto, relLevel } from "@/lib/util";
import { useSession } from "../AuthGate";
import { Empty, Gauge } from "../ui";
import { alvoStartup, SREJECT, StartupDrawer } from "./StartupDrawer";
import { FindStartups } from "./FindStartups";
import { Logo } from "./Logo";
import { StartupsTable } from "./StartupsTable";
import { useDeals } from "../pipeline/DealsLookup";
import { nomeEtapa } from "@/lib/deal-actions";
import { AnaliseLoading, useAnaliseQueue } from "../AnaliseQueue";
import { AnaliseView } from "./AnaliseView";

const VIEW_KEY = "radar.startups.vista";
const readView = (): "cards" | "list" => { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards"; } catch { return "cards"; } };

const TITLES: Record<Status, [string, string]> = {
  pending: ["Triagem", "Startups encontradas na pesquisa semanal, nas notícias e à mão, à espera de decisão."],
  rejected: ["Arquivo de triagem", "Startups arquivadas na triagem, com quem não chegámos a falar. Não voltam a ser propostas pela recolha semanal. Podes devolvê-las à triagem ou eliminá-las."],
  approved: ["Aprovadas", "Startups aprovadas na triagem que ainda não estão no Pipeline. Entram no radar de startups quando passam para o Pipeline."],
};

export function StartupsTriage({ areas, status, onStatus, startups, sectors, loaded, search, adding, setAdding, abrir }: {
  areas: Area[]; status: Status; onStatus: (s: Status) => void; startups: Startup[]; sectors: Sector[]; loaded: boolean; search: string; adding: boolean; setAdding: (v: boolean) => void;
  /** Ficha a abrir ao entrar (vem da pesquisa global). */
  abrir?: string;
}) {
  const { email } = useSession();
  const { dealOf } = useDeals();
  const [fSec, setFSec] = useState("all");
  const [fFase, setFFase] = useState("all");
  const [fCad, setFCad] = useState("all");
  const [sort, setSort] = useState<"score" | "date">("score");
  const [viewS, setViewS] = useState<"cards" | "list">("cards");
  const view = viewS;
  useEffect(() => setViewS(readView()), []);
  const setView = (v: "cards" | "list") => { setViewS(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* sem armazenamento */ } };
  const [openId, setOpenId] = useState<string | null>(abrir || null);
  const [anFor, setAnFor] = useState<Startup | null>(null);
  const [rejectCard, setRejectCard] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: SSnapshot } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = (msg: string, undo?: SSnapshot) => { setToast({ msg, undo }); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 5000); };
  // Ao mudar de estado fecha a ficha aberta (na primeira vez não, para a ficha pedida pela pesquisa global ficar aberta)
  const primeiro = useRef(true);
  useEffect(() => { if (primeiro.current) { primeiro.current = false; return; } setOpenId(null); setRejectCard(null); }, [status]);

  const sec = (id: string) => sectors.find((x) => x.id === id);
  const list = useMemo(() => {
    let l = startups.filter((s) => s.status === status);
    if (fSec !== "all") l = l.filter((s) => s.setor === fSec);
    if (fFase !== "all") l = l.filter((s) => s.fase === fFase);
    if (fCad !== "all") l = l.filter((s) => s.cadeia === fCad);
    if (search) { const q = search.toLowerCase(); l = l.filter((s) => `${s.nome} ${s.dominio} ${s.descricao} ${s.pais} ${(s.investidores || []).join(" ")}`.toLowerCase().includes(q)); }
    return [...l].sort((a, b) => sort === "date" ? b.criadoEm.localeCompare(a.criadoEm) : b.relevancia - a.relevancia);
  }, [startups, status, fSec, fFase, fCad, search, sort]);

  // 40 por página; volta à 1.ª quando os filtros mudam
  const pageKey = `${status}|${fSec}|${fFase}|${fCad}|${search}|${sort}`;
  // Contagens de cada opção com os outros dois filtros aplicados
  const doEstado = startups.filter((s) => s.status === status);
  const nSec = (id: string) => doEstado.filter((s) => s.setor === id && (fFase === "all" || s.fase === fFase) && (fCad === "all" || s.cadeia === fCad)).length;
  const nFase = (id: string) => doEstado.filter((s) => s.fase === id && (fSec === "all" || s.setor === fSec) && (fCad === "all" || s.cadeia === fCad)).length;
  const nCad = (id: string) => doEstado.filter((s) => s.cadeia === id && (fSec === "all" || s.setor === fSec) && (fFase === "all" || s.fase === fFase)).length;
  const pg = usePaged(list, pageKey);

  /** Arquivar: vai para o arquivo de triagem (fica guardada, a recolha semanal não a volta a propor). */
  const rej = (s: Startup, m: string) => rejectStartup(s, m);
  /** Eliminar: sai logo da vista e é apagada da base de dados quando o aviso com Anular desaparece. */
  const elim = (s: Startup) => rejectStartup(s, s.motivoRejeicao || "Eliminada").then((snap) => { agendarApagar(`s:${s.id}`, () => purgeStartup(s, "eliminada")); return snap; });
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
    {status !== "approved" && (
      <div className="seg trseg" role="group" aria-label="Triagem">
        <button aria-pressed={status === "pending"} onClick={() => onStatus("pending")}><Icon name="tray" />Por decidir<span className="sc">{startups.filter((s) => s.status === "pending").length}</span></button>
        <button aria-pressed={status === "rejected"} onClick={() => onStatus("rejected")}><Icon name="prohibit" />Arquivo de triagem<span className="sc">{startups.filter((s) => s.status === "rejected").length}</span></button>
      </div>
    )}
    <div className="toolbar">
      <AreaSelect areas={areas} value={fCad} onChange={setFCad} counts={nCad} />
      <SectorSelect sectors={sectors} value={fSec} onChange={setFSec} counts={nSec} />
      <FaseSelect fases={[...FASES].reverse()} value={fFase} onChange={setFFase} counts={nFase} />
      <span className="sp" />
      {view === "cards" && <div className="seg" role="group" aria-label="Ordenar">
        <button aria-pressed={sort === "score"} onClick={() => setSort("score")}>Relevância</button>
        <button aria-pressed={sort === "date"} onClick={() => setSort("date")}>Recentes</button>
      </div>}
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
      <StartupsTable list={list} sectors={sectors} onOpen={setOpenId} onAnalise={setAnFor} pageKey={pageKey}
        onApprove={(s) => act(approveStartup(s, email), `«${s.nome}» aprovada`)}
        onReject={(s, m) => act(rej(s, m), `«${s.nome}» arquivada no arquivo de triagem`)} onBack={(s) => act(startupBackToTriage(s), `«${s.nome}» voltou à triagem`)} onDelete={(s) => act(elim(s), `«${s.nome}» eliminada`)}
        onBulk={async (ids, acao, motivo) => {
          const sel = startups.filter((s) => ids.includes(s.id));
          try {
            await Promise.all(sel.map((s) => acao === "approve" ? approveStartup(s, email) : acao === "reject" ? rej(s, motivo || "Pouco relevante") : acao === "delete" ? elim(s) : startupBackToTriage(s)));
            const pl = sel.length > 1 ? "s" : "";
            notify(`${sel.length} startup${pl} ${acao === "approve" ? `aprovada${pl}` : acao === "reject" ? `arquivada${pl} no arquivo de triagem` : acao === "delete" ? `eliminada${pl}` : "de volta à triagem"}`);
          } catch { notify("Algumas não foram guardadas. Tenta outra vez."); }
        }} />
    ) : (
      <><div ref={pg.top} className="pgr-anchor" />
      <div className="grid">
        {pg.items.map((s) => {
          const c = sec(s.setor), fase = FASES.find((f) => f.id === s.fase), lv = relLevel(s.relevancia);
          return (
            <article key={s.id} className={"card scard"} style={{ ["--c" as string]: c?.cor || "var(--ink-tertiary)" }} data-lv={lv}>
              <div className="cbody" role="button" tabIndex={0} aria-label={`Abrir ${s.nome}`} onClick={() => setOpenId(s.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(s.id); } }}>
                <div className="ctopg">
                  <div className="tags">
                    <span className="tg ar">{c?.nome || "Sem categoria"}</span>
                    {areas.find((a) => a.id === s.cadeia) && <span className="tg"><i className="cdot" style={{ background: areas.find((a) => a.id === s.cadeia)!.cor }} />{areas.find((a) => a.id === s.cadeia)!.nome}</span>}
                    <span className="tg">{fase?.nome}</span>
                    
                    {dealOf(s) && <span className="tg pipe" title={`No pipeline: ${nomeEtapa(dealOf(s)!.etapa)}`}><Icon name="kanban" />{dealOf(s)!.etapa === "arquivada" ? "Arquivada no pipeline" : nomeEtapa(dealOf(s)!.etapa)}</span>}
                    <AnaliseLoading path={`startups/${s.id}`} short />
                    <AnChip s={s} onOpen={() => setAnFor(s)} />
                  </div>
                  <Gauge v={s.relevancia} />
                </div>
                <div className="sname"><Logo nome={s.nome} logo={s.logo} /><div><h3>{s.nome}</h3><span className="sdom">{s.dominio}</span></div></div>
                <p className="snip">{s.descricao}</p>
                <div className="cfoot">
                  <span>{[s.pais, s.fundacao ? `fundada em ${s.fundacao}` : ""].filter(Boolean).join(", ") || "Sem dados de país"}</span>
                  <span className="sp" /><span title="Quando entrou">{fdCurto(s.criadoEm)}</span>
                </div>
              </div>
              {s.status === "pending" ? (rejectCard === s.id ? (
                <div className="reasons"><div className="rh">Porque arquivas?<button className="txtbtn" onClick={() => setRejectCard(null)}>Cancelar</button></div>
                  <div className="rgrid">{SREJECT.map((m) => <button key={m} onClick={() => { setRejectCard(null); act(rej(s, m), `«${s.nome}» arquivada no arquivo de triagem`); }}>{m}</button>)}</div></div>
              ) : (
                <div className="cact">
                  <button className="btn primary" onClick={() => act(approveStartup(s, email), `«${s.nome}» aprovada`)}><Icon name="check" />Aprovar</button>
                  <button className="btn" onClick={() => setRejectCard(s.id)}><Icon name="prohibit" />Arquivar</button><span className="sp" />
                  <button className="btn icon" title="Eliminar" aria-label={`Eliminar ${s.nome}`} onClick={() => act(elim(s), `«${s.nome}» eliminada`)}><Icon name="trash" /></button>
                </div>
              )) : (
                <div className="cact">
                  <button className="btn" onClick={() => act(startupBackToTriage(s), `«${s.nome}» voltou à triagem`)}><Icon name="arrow-u-up-left" />Voltar à triagem</button><span className="sp" />
                  {s.status === "rejected" && <button className="btn icon" title="Eliminar" aria-label={`Eliminar ${s.nome}`} onClick={() => act(elim(s), `«${s.nome}» eliminada`)}><Icon name="trash" /></button>}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Pager {...pg} label="startups" /></>
    )}

    {open && (
      <StartupDrawer s={open} list={list} sectors={sectors} areas={areas} onClose={() => setOpenId(null)} onNav={setOpenId} notify={(m) => notify(m)}
        onApprove={() => act(approveStartup(open, email), `«${open.nome}» aprovada`, true)}
        onReason={(m) => act(rej(open, m), `«${open.nome}» arquivada no arquivo de triagem`, true)} onBack={() => act(startupBackToTriage(open), `«${open.nome}» voltou à triagem`, true)} onDelete={() => act(elim(open), `«${open.nome}» eliminada`, true)} />
    )}
    {adding && <FindStartups mode="search" sectors={sectors} areas={areas} startups={startups} onClose={() => setAdding(false)}
      onDone={(msg, onde) => { setAdding(false); if (onde !== "pipeline") onStatus(onde === "approved" ? "approved" : "pending"); notify(msg); }} />}
    {toast && (
      <div className="toast" role="status"><span>{toast.msg}</span>
        {toast.undo && <button className="btn" onClick={() => { cancelarApagar(`s:${toast.undo!.id}`); restoreStartup(toast.undo!).then(() => notify("Anulado")); }}><Icon name="arrow-counter-clockwise" />Anular</button>}
      </div>
    )}
    {anFor && <AnaliseView alvo={alvoStartup(anFor, sectors.find((x) => x.id === anFor.setor)?.nome || "")} onClose={() => setAnFor(null)} notify={(m) => notify(m)} />}
  </>);
}

/** Atalho para a análise de investimento, sem abrir a ficha. */
export function AnChip({ s, onOpen }: { s: Startup; onOpen: () => void }) {
  const { running } = useAnaliseQueue();
  if (running.has(`startups/${s.id}`)) return null;
  const a = s.analiseResumo;
  return <button type="button" className={`anchip btn-an ${a ? a.decisao : "none"}`} title={a ? `Análise de investimento: ${nomeDecisao(a.decisao).toLowerCase()}, ${a.positivos} de 11 critérios positivos` : "Fazer a análise de investimento"}
    onClick={(e) => { e.stopPropagation(); onOpen(); }} onKeyDown={(e) => e.stopPropagation()}>
    <Icon name="scales" />{a ? "Ver análise" : "Fazer análise"}</button>;
}
