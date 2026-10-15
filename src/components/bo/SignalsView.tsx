"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { approve, backToTriage, EditFields, reject, restore, saveEdit, Snapshot, toggleStar } from "@/lib/bo-actions";
import { DraftFields } from "./DraftFields";
import { Area, Category, REJECT_REASONS, Signal, Status } from "@/lib/types";
import { fdCurto, fdLongo, monogram, relLevel } from "@/lib/util";
import { useSession } from "./AuthGate";
import { Empty, Gauge } from "./ui";

const TITLES: Record<Status, [string, string]> = {
  pending: ["Triagem", "Notícias novas à espera de decisão. Abre um cartão para ler o resumo completo e as fontes."],
  approved: ["Aprovadas", "Estas notícias estão visíveis no radar. Os destaques aparecem primeiro."],
  rejected: ["Rejeitadas", "Ficam guardadas com o motivo, para afinar a classificação."],
};

export function SignalsView({ status, signals, areas, cats, loaded, search }: {
  status: Status; signals: Signal[]; areas: Area[]; cats: Category[]; loaded: boolean; search: string;
}) {
  const { email } = useSession();
  const [fArea, setFArea] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [sort, setSort] = useState<"score" | "date">("score");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rejectCard, setRejectCard] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: Snapshot[] } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setPicked(new Set()); setRejectCard(null); setOpenId(null); }, [status]);

  const area = (id: string) => areas.find((a) => a.id === id);
  const cat = (id: string) => cats.find((c) => c.id === id);

  const list = useMemo(() => {
    let l = signals.filter((s) => s.status === status);
    if (fArea !== "all") l = l.filter((s) => s.area === fArea);
    if (fCat !== "all") l = l.filter((s) => s.categoria === fCat);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((s) => `${s.titulo} ${s.resumo} ${(s.entidades || []).join(" ")} ${s.fontes.map((f) => f.site).join(" ")}`.toLowerCase().includes(q));
    }
    return l.sort((a, b) => (sort === "score" ? b.relevancia - a.relevancia : b.dataPublicacao.localeCompare(a.dataPublicacao)));
  }, [signals, status, fArea, fCat, search, sort]);

  const notify = (msg: string, undo?: Snapshot[]) => {
    clearTimeout(toastT.current);
    setToast({ msg, undo });
    toastT.current = setTimeout(() => setToast(null), 5000);
  };
  const fail = (e: unknown) => { console.error(e); notify("Não foi possível guardar. Verifica a ligação e tenta outra vez."); };

  const nextAfter = (id: string) => { const i = list.findIndex((x) => x.id === id); const rest = list.filter((x) => x.id !== id); return rest[Math.min(i, rest.length - 1)]?.id || null; };

  const doApprove = async (s: Signal, fromDrawer = false) => {
    try { const p = await approve(s, email); notify("Aprovada para o radar", [p]); if (fromDrawer) setOpenId(nextAfter(s.id)); } catch (e) { fail(e); }
  };
  const doReject = async (s: Signal, motivo: string, fromDrawer = false) => {
    try { const p = await reject(s, motivo); setRejectCard(null); notify(`Rejeitada: ${motivo}`, [p]); if (fromDrawer) setOpenId(nextAfter(s.id)); } catch (e) { fail(e); }
  };
  const doBack = async (s: Signal) => { try { const p = await backToTriage(s); notify("Voltou à triagem", [p]); } catch (e) { fail(e); } };
  const doStar = async (s: Signal) => { try { await toggleStar(s); notify(s.destaque ? "Destaque removido" : "Marcada como destaque"); } catch (e) { fail(e); } };
  const doBulk = async (to: "approved" | "rejected") => {
    const items = list.filter((s) => picked.has(s.id));
    try {
      const snaps = await Promise.all(items.map((s) => (to === "approved" ? approve(s, email) : reject(s, "Pouco relevante"))));
      setPicked(new Set());
      notify(`${items.length} ${to === "approved" ? "aprovadas" : "rejeitadas"}`, snaps);
    } catch (e) { fail(e); }
  };
  const doUndo = async (snaps: Snapshot[]) => { try { await Promise.all(snaps.map(restore)); notify("Anulado"); } catch (e) { fail(e); } };

  const togglePick = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const allCount = signals.length;
  const pend = signals.filter((s) => s.status === "pending").length;
  const ord = [...signals].sort((a, b) => b.relevancia - a.relevancia);

  const groups: [string, Signal[], string?][] =
    sort !== "score" || status === "rejected" ? [["", list]]
      : status === "approved" ? [["Em destaque", list.filter((s) => s.destaque)], ["Restantes", list.filter((s) => !s.destaque)]]
        : [["Relevância alta", list.filter((s) => s.relevancia >= 85), "var(--g-ok)"], ["Relevância média", list.filter((s) => s.relevancia >= 65 && s.relevancia < 85), "var(--g-mid)"], ["Relevância baixa", list.filter((s) => s.relevancia < 65), "var(--g-low)"]];

  const open = signals.find((s) => s.id === openId) || null;

  return (
    <>
      <div className="head">
        <div style={{ flex: 1, minWidth: 260 }}><h1>{TITLES[status][0]}</h1><p>{TITLES[status][1]}</p></div>
        {status === "pending" && allCount > 0 && (
          <div className="stat">
            <div className="segs" aria-hidden="true">{ord.slice(0, 60).map((s) => <i key={s.id} className={s.status === "approved" ? "ok" : s.status === "rejected" ? "no" : ""} />)}</div>
            <div className="stxt"><span><b>{pend}</b> por decidir</span><span>{allCount - pend} decididas</span></div>
          </div>
        )}
      </div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Área">
          <button aria-pressed={fArea === "all"} onClick={() => setFArea("all")}>Todas as áreas</button>
          {areas.map((a) => <button key={a.id} aria-pressed={fArea === a.id} onClick={() => setFArea(a.id)}>{a.nome}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Categoria">
          <button aria-pressed={fCat === "all"} onClick={() => setFCat("all")}>Todas</button>
          {cats.map((c) => <button key={c.id} aria-pressed={fCat === c.id} onClick={() => setFCat(c.id)}><Icon name={c.icone} />{c.nome}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Ordenar">
          <button aria-pressed={sort === "score"} onClick={() => setSort("score")}>Relevância</button>
          <button aria-pressed={sort === "date"} onClick={() => setSort("date")}>Recentes</button>
        </div>
        {status === "pending" && list.length > 0 && (<>
          <span className="sp" />
          <button className="txtbtn" onClick={() => setPicked(picked.size ? new Set() : new Set(list.map((s) => s.id)))}>{picked.size ? "Limpar seleção" : "Selecionar todas"}</button>
        </>)}
      </div>

      {!loaded ? <div className="loading">A carregar…</div> : list.length === 0 ? (
        status === "pending" && allCount > 0 && !search && fArea === "all" && fCat === "all"
          ? <Empty icon={<Icon name="check-circle" size={22} />} title="Fila limpa" text="Decidiste tudo o que entrou. A próxima recolha corre amanhã às 6h30." />
          : status === "pending" && allCount === 0
            ? <Empty icon={<Icon name="tray" size={22} />} title="Ainda sem notícias" text="Assim que o pipeline diário correr, as notícias novas aparecem aqui para decidires." />
            : <Empty icon={<Icon name="magnifying-glass" size={22} />} title="Sem resultados" text="Nenhuma notícia corresponde a este filtro." />
      ) : groups.filter((g) => g[1].length).map(([t, l, c]) => (
        <section className="group" key={t || "all"}>
          {t && <div className="gh">{c && <i style={{ background: c }} />}<h2>{t}</h2><span>{l.length}</span></div>}
          <div className={`grid${picked.size ? " picking" : ""}`}>
            {l.map((s) => (
              <Card key={s.id} s={s} area={area(s.area)} cat={cat(s.categoria)} picked={picked.has(s.id)} rejecting={rejectCard === s.id}
                onOpen={() => setOpenId(s.id)} onPick={() => togglePick(s.id)} onApprove={() => doApprove(s)}
                onReject={() => setRejectCard(s.id)} onReason={(m) => doReject(s, m)} onCancel={() => setRejectCard(null)}
                onStar={() => doStar(s)} onBack={() => doBack(s)} />
            ))}
          </div>
        </section>
      ))}

      {picked.size > 0 && status === "pending" && (
        <div className="bulk"><span>{picked.size} selecionada{picked.size > 1 ? "s" : ""}</span>
          <button className="btn primary" onClick={() => doBulk("approved")}><Icon name="check" />Aprovar</button>
          <button className="btn" onClick={() => doBulk("rejected")}><Icon name="x" />Rejeitar</button>
          <button className="btn icon" title="Limpar seleção" onClick={() => setPicked(new Set())}><Icon name="x" /></button>
        </div>
      )}

      {open && (
        <Drawer s={open} list={list} areas={areas} cats={cats} onClose={() => setOpenId(null)} onNav={setOpenId}
          onApprove={() => doApprove(open, true)} onReason={(m) => doReject(open, m, true)} onStar={() => doStar(open)} onBack={() => doBack(open)}
          onSave={async (f) => { try { await saveEdit(open, f); notify("Alterações guardadas"); } catch (e) { fail(e); } }} />
      )}

      {toast && (
        <div className="toast" role="status"><span>{toast.msg}</span>
          {toast.undo && <button className="btn" onClick={() => { doUndo(toast.undo!); }}><Icon name="arrow-counter-clockwise" />Anular</button>}
        </div>
      )}
    </>
  );
}

function Card({ s, area, cat, picked, rejecting, onOpen, onPick, onApprove, onReject, onReason, onCancel, onStar, onBack }: {
  s: Signal; area?: Area; cat?: Category; picked: boolean; rejecting: boolean; onOpen: () => void; onPick: () => void; onApprove: () => void;
  onReject: () => void; onReason: (m: string) => void; onCancel: () => void; onStar: () => void; onBack: () => void;
}) {
  const src = [...new Set(s.fontes.map((f) => f.site))];
  return (
    <article className={`card${s.destaque ? " star" : ""}${picked ? " picked" : ""}`} style={{ ["--c" as string]: area?.cor || "var(--ink-tertiary)" }}>
      <div className="cbody" role="button" tabIndex={0} aria-label={`Abrir ${s.titulo}`} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
        <div className="ctopg">
          <div className="tags">
            <span className="tg ar">{area?.nome || "Sem área"}</span>
            <span className="tg">{cat && <Icon name={cat.icone} />}{cat?.nome || "Sem categoria"}</span>
            {s.flagNovaFonte && s.status === "pending" && <span className="tg new">Nova fonte</span>}
            {s.destaque && <span className="tg star"><Icon name="star-fill" />Destaque</span>}
            {s.status === "rejected" && <span className="tg no">{s.motivoRejeicao}</span>}
          </div>
          <Gauge v={s.relevancia} />
        </div>
        <h3>{s.titulo}</h3>
        <p className="snip">{(s.resumo || "").split(/\n\s*\n/)[0]}</p>
        <div className="cfoot">
          <span className="stack">{src.map((x) => <span key={x} className="mono" title={x}>{monogram(x)}</span>)}</span>
          <span>{src.length > 1 ? `${src.length} fontes` : src[0]}</span><span className="sp" /><span>{fdCurto(s.dataPublicacao)}</span>
        </div>
      </div>
      {s.status === "pending" ? (rejecting ? (
        <div className="reasons"><div className="rh">Porque rejeitas?<button className="txtbtn" onClick={onCancel}>Cancelar</button></div>
          <div className="rgrid">{REJECT_REASONS.map((m) => <button key={m} onClick={() => onReason(m)}>{m}</button>)}</div></div>
      ) : (
        <div className="cact">
          <button className="chk" role="checkbox" aria-checked={picked} aria-label="Selecionar" onClick={onPick}><Icon name="check" /></button>
          <button className="btn primary" onClick={onApprove}><Icon name="check" />Aprovar</button>
          <button className="btn" onClick={onReject}><Icon name="x" />Rejeitar</button><span className="sp" />
          <button className="btn icon" aria-pressed={!!s.destaque} title="Destacar no radar" onClick={onStar}><Icon name={s.destaque ? "star-fill" : "star"} /></button>
        </div>
      )) : (
        <div className="cact">
          <button className="btn" onClick={onBack}><Icon name="arrow-u-up-left" />Voltar à triagem</button><span className="sp" />
          {s.status === "approved" && <button className="btn icon" aria-pressed={!!s.destaque} title="Destacar no radar" onClick={onStar}><Icon name={s.destaque ? "star-fill" : "star"} /></button>}
        </div>
      )}
    </article>
  );
}

function Drawer({ s, list, areas, cats, onClose, onNav, onApprove, onReason, onStar, onBack, onSave }: {
  s: Signal; list: Signal[]; areas: Area[]; cats: Category[]; onClose: () => void; onNav: (id: string) => void;
  onApprove: () => void; onReason: (m: string) => void; onStar: () => void; onBack: () => void;
  onSave: (f: EditFields) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const pick = (x: Signal): EditFields => ({ titulo: x.titulo, resumo: x.resumo, porque: x.porque || "", entidades: x.entidades || [], area: x.area, categoria: x.categoria, relevancia: x.relevancia, dataPublicacao: x.dataPublicacao });
  const [f, setF] = useState<EditFields>(pick(s));
  useEffect(() => { setEditing(false); setRejecting(false); setF(pick(s)); }, [s.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const startEdit = () => { setF(pick(s)); setEditing(true); };
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (editing) setEditing(false); else if (rejecting) setRejecting(false); else onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [editing, rejecting, onClose]);

  const i = list.findIndex((x) => x.id === s.id);
  const area = areas.find((a) => a.id === s.area), cat = cats.find((c) => c.id === s.categoria);
  const lv = relLevel(s.relevancia);
  const merged = s.fontes.length > 1;
  const save = async () => { await onSave(f); setEditing(false); };

  return (<>
    <div className="scrim" onClick={onClose} />
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={s.titulo}>
      <div className="dtop"><span className="pos">{i >= 0 ? `${i + 1} de ${list.length}` : ""}</span><span className="sp" />
        <button className="btn icon" title="Anterior" disabled={i <= 0} onClick={() => onNav(list[i - 1].id)}><Icon name="caret-up" /></button>
        <button className="btn icon" title="Seguinte" disabled={i < 0 || i >= list.length - 1} onClick={() => onNav(list[i + 1].id)}><Icon name="caret-down" /></button>
        <button className="btn icon" title="Fechar" onClick={onClose}><Icon name="x" /></button></div>
      <div className="dscroll">
        <div className="dmeta">
          <span className="tg ar" style={{ ["--c" as string]: area?.cor || "var(--ink-tertiary)" }}>{area?.nome}</span><span className="tg">{cat && <Icon name={cat.icone} />}{cat?.nome}</span>
          {s.status === "approved" && <span className="badge ok"><Icon name="check" />Aprovada</span>}
          {s.manual && <span className="badge"><Icon name="pencil-simple" />Adicionada à mão</span>}
          {s.status === "rejected" && <span className="badge no"><Icon name="x" />{s.motivoRejeicao}</span>}
          <span>{fdCurto(s.dataPublicacao)}</span><span>{merged ? `${s.fontes.length} fontes` : "1 fonte"}</span>
        </div>
        {editing ? (
          <div className="blk"><div className="bh"><h4>Editar notícia</h4>
            <span style={{ display: "flex", gap: 6 }}><button className="txtbtn" onClick={() => setEditing(false)}>Cancelar</button><button className="txtbtn" onClick={save}><Icon name="check" />Guardar alterações</button></span></div>
            <DraftFields value={f} onChange={(p) => setF({ ...f, ...p })} areas={areas} cats={cats} />
          </div>
        ) : (<>
        <h2>{s.titulo}</h2>
        <div className="relbox"><Gauge v={s.relevancia} lg /><div>
          <b>Relevância <span className={`lv-${lv}`}>{({ alta: "alta", media: "média", baixa: "baixa" })[lv]}</span>, {s.relevancia} em 100</b>
          <details className="whyd" open={whyOpen} onToggle={(e) => setWhyOpen((e.target as HTMLDetailsElement).open)}>
            <summary><Icon name="lightbulb" />Porque importa para a Sogrape<Icon name="caret-down" className="chev" /></summary><p>{s.porque}</p>
          </details>
          <div className="scale"><span><i style={{ background: "var(--g-ok)" }} />Alta, 85 ou mais</span><span><i style={{ background: "var(--g-mid)" }} />Média, 65 a 84</span><span><i style={{ background: "var(--g-low)" }} />Baixa, menos de 65</span></div>
          <p className="relnote">A relevância mede a proximidade ao nosso negócio, o impacto possível e a fiabilidade da fonte. É calculada pela Gemini na recolha.</p>
        </div></div>
        {s.flagNovaFonte && s.status === "pending" && (
          <div className="notice"><Icon name="stack" /><span>Entrou uma fonte nova e o resumo foi refeito.{s.noRadar ? " O radar continua a mostrar a versão aprovada anterior até voltares a aprovar." : ""}</span></div>
        )}
        <div className="blk"><div className="bh"><h4>Classificação</h4></div><div className="classif">
          <div className="f"><span>Área</span><b>{area?.nome}</b></div><div className="f"><span>Categoria</span><b>{cat?.nome}</b></div>
        </div></div>
        <div className="blk"><div className="bh"><h4>{merged ? "Resumo combinado" : "Resumo"}</h4>
          {s.status !== "rejected" && <button className="txtbtn" onClick={startEdit}><Icon name="pencil-simple" />Editar</button>}
        </div>
          <div className="summary">{s.resumo.split(/\n\s*\n/).map((t, i) => <p key={i}>{t}</p>)}</div>
        </div>
        </>)}
        <div className="blk"><div className="bh"><h4>Fontes</h4></div><div className="sources">
          {s.fontes.map((x) => (
            <a key={x.urlHash} className="s" href={x.url} target="_blank" rel="noopener noreferrer">
              <span className="mono">{monogram(x.site)}</span><span className="t">{x.tituloOriginal}</span>
              <span className="go"><Icon name="arrow-up-right" /></span>
              <span className="m"><span>{x.site}, {fdLongo(x.data)}</span>{x.autor && <span>{x.autor}</span>}</span>
            </a>
          ))}
        </div></div>
        {s.entidades?.length > 0 && <div className="blk"><div className="bh"><h4>Entidades</h4></div><div className="ents">{s.entidades.map((e) => <span key={e} className="badge">{e}</span>)}</div></div>}
      </div>
      <div className="dbar">
        {s.status === "pending" ? (rejecting ? (
          <div className="reasons"><div className="rh">Porque rejeitas?<button className="txtbtn" onClick={() => setRejecting(false)}>Cancelar</button></div>
            <div className="rgrid">{REJECT_REASONS.map((m) => <button key={m} onClick={() => onReason(m)}>{m}</button>)}</div></div>
        ) : (<>
          <button className="btn primary lg" onClick={onApprove}><Icon name="check" />Aprovar</button>
          <button className="btn lg" onClick={() => setRejecting(true)}><Icon name="x" />Rejeitar</button><span className="sp" />
          <button className="btn lg icon" aria-pressed={!!s.destaque} title="Destacar no radar" onClick={onStar}><Icon name={s.destaque ? "star-fill" : "star"} /></button>
          <button className="btn lg icon" title="Editar" onClick={startEdit}><Icon name="pencil-simple" /></button>
        </>)) : (
          <button className="btn lg" onClick={onBack}><Icon name="arrow-u-up-left" />Voltar à triagem</button>
        )}
      </div>
    </aside>
  </>);
}
