"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { lerFolha, type Celula } from "@/lib/xlsx-lite";
import { Icon } from "@/components/Icon";
import { corDe } from "@/lib/inovacao";
import type { Category, Startup } from "@/lib/types";
import { Logo } from "../startups/Logo";

/** Uma coleção em tempo real. */
export function useLive<T extends { id: string }>(col: string) {
  const [list, setList] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => onSnapshot(collection(db, col), (s) => { setList(s.docs.map((d) => ({ ...d.data(), id: d.id }) as T)); setLoaded(true); setErro(""); },
    (e) => { setErro((e as { code?: string }).code === "permission-denied" ? "Sem permissão para ler esta coleção. Publica as regras do Firestore atualizadas." : "Não foi possível carregar."); setLoaded(true); }), [col]);
  return { list, loaded, erro };
}

/** Importação inicial a partir do Excel de Inovação (só aparece com a coleção vazia). */
export function ImportarExcel<T extends { id: string }>({ folha, col, conv, nome, notify }: {
  folha: string; col: string; conv: (rows: Celula[][], agora: string) => T[]; nome: string; notify: (m: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const ler = async (f: File) => {
    setBusy(true);
    try {
      const itens = conv(await lerFolha(f, folha), new Date().toISOString());
      if (!itens.length) throw new Error(`A folha «${folha}» está vazia ou não existe.`);
      for (let i = 0; i < itens.length; i += 400) {
        const b = writeBatch(db);
        for (const { id, ...x } of itens.slice(i, i + 400)) b.set(doc(db, col, id), x);
        await b.commit();
      }
      notify(`${itens.length} ${nome} importados`);
    } catch (e) { notify((e as Error).message || "Não foi possível importar."); }
    setBusy(false);
  };
  return (<>
    <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
      {busy ? <><span className="spin" aria-hidden="true" />A importar…</> : <><Icon name="upload-simple" />Importar do Excel</>}</button>
    <input ref={input} type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) ler(f); }} />
  </>);
}

/** Lista de opções num select de formulário, com uma vazia. */
export function Sel({ label, value, opcoes, onChange, vazio = "Por definir", cls = "fld" }: {
  label: string; value: string; opcoes: (string | { id: string; nome: string })[]; onChange: (v: string) => void; vazio?: string; cls?: string;
}) {
  const ops = opcoes.map((o) => (typeof o === "string" ? { id: o, nome: o } : o));
  return <label className={cls}><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">{vazio}</option>
    {value && !ops.some((o) => o.id === value) && <option value={value}>{value}</option>}
    {ops.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>;
}

export function SimNao({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <label className="fld"><span>{label}</span><select value={value ? "s" : "n"} onChange={(e) => onChange(e.target.value === "s")}>
    <option value="n">Não</option><option value="s">Sim</option></select></label>;
}

export function Eur({ label, v, on }: { label: string; v: number | null; on: (n: number | null) => void }) {
  return <label className="fld"><span>{label}</span><input type="number" min={0} step="0.01" inputMode="decimal" placeholder="€" value={v ?? ""}
    onChange={(e) => on(e.target.value === "" ? null : Number(e.target.value))} /></label>;
}

/** Parceiro: escolhe um dos que já existem ou escreve um novo (recebe uma ref PA nova ao guardar). */
export function Parceiro({ nome, parceiros, onChange }: { nome: string; parceiros: { ref: string; nome: string }[]; onChange: (nome: string, ref: string) => void }) {
  const id = "parc-" + useRef(Math.random().toString(36).slice(2)).current;
  return <label className="fld wide"><span>Parceiro</span>
    <input list={id} value={nome} placeholder="Escolhe ou escreve um novo" onChange={(e) => {
      const v = e.target.value, p = parceiros.find((x) => x.nome.toLowerCase() === v.trim().toLowerCase());
      onChange(v, p?.ref || "");
    }} />
    <datalist id={id}>{parceiros.map((p) => <option key={p.ref + p.nome} value={p.nome}>{p.ref}</option>)}</datalist></label>;
}

/** Linha de números no topo de cada página. */
export function Kpis({ itens }: { itens: { l: string; v: string | number }[] }) {
  return <dl className="inv-kpis">{itens.map((k) => <div key={k.l}><dt>{k.l}</dt><dd>{k.v}</dd></div>)}</dl>;
}

/** Cabeçalho de coluna ordenável. */
export function th<C extends string>(sort: { col: C; dir: 1 | -1 }, setSort: (s: { col: C; dir: 1 | -1 }) => void, col: C, label: string, cls = "", desc = false) {
  return <th key={col} className={cls} aria-sort={sort.col === col ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
    <button className="thb" onClick={() => setSort(sort.col === col ? { col, dir: sort.dir === 1 ? -1 : 1 } : { col, dir: desc ? -1 : 1 })}>
      {label}<Icon name={sort.col === col ? (sort.dir === 1 ? "caret-up" : "caret-down") : "caret-up-down"} /></button></th>;
}

/** Ordena por um valor (texto ou número); vazios no fim. */
export function ordenar<T>(l: T[], v: (x: T) => string | number | null, dir: 1 | -1) {
  return [...l].sort((a, b) => {
    const x = v(a), y = v(b);
    if (x === y) return 0; if (x === null || x === "") return 1; if (y === null || y === "") return -1;
    return (x < y ? -1 : 1) * dir;
  });
}

/** Etiqueta com a cor do valor (estado, Must Win Battle, tipo, papel...). */
export function Tag({ v, dot = false }: { v: string; dot?: boolean }) {
  if (!v) return null;
  return <span className="tg inv-tag" style={{ ["--c" as string]: corDe(v) }}>{dot && <i className="inv-dot" />}{v}</span>;
}

/** Opções para os filtros em dropdown (o mesmo componente dos filtros da triagem). */
export const opcoes = (l: (string | { id: string; nome: string; cor?: string })[], cor = true): Category[] =>
  l.map((x, i) => { const o = typeof x === "string" ? { id: x, nome: x } : x; return { id: o.id, nome: o.nome, ...(cor ? { cor: ("cor" in o && o.cor) || corDe(o.id) } : {}), icone: "calendar-blank", descricao: "", ordem: i, palavrasChave: [] } as unknown as Category; });

/** Lista de dados do detalhe (só mostra os que têm valor). */
export function Dados({ itens }: { itens: [string, React.ReactNode][] }) {
  const l = itens.filter(([, v]) => v !== "" && v !== null && v !== undefined && v !== false);
  return l.length ? <dl className="inv-dados">{l.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null;
}

/** Página do detalhe: abre em modo de leitura, com o botão para editar; os novos abrem logo em edição. */
export function Detalhe({ titulo, refTxt, tags, editando, onEditar, onCancelar, onGuardar, onApagar, onClose, leitura, edicao, voltar }: {
  titulo: string; refTxt: string; tags?: React.ReactNode; editando: boolean; onEditar: () => void; onCancelar: () => void;
  onGuardar: () => Promise<unknown> | void; onApagar?: () => void; onClose: () => void; leitura: React.ReactNode; edicao: React.ReactNode; voltar: string;
}) {
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && editando && !document.querySelector(".mdl.cfm")) onCancelar(); };
    document.addEventListener("keydown", k);
    if (editando) box.current?.querySelector<HTMLElement>(".pfo input,.pfo textarea,.pfo select")?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", k);
  }, [editando, onCancelar]);
  const guardar = async (e?: React.FormEvent) => { e?.preventDefault(); if (busy) return; setBusy(true); try { await onGuardar(); } finally { setBusy(false); } };
  const acoes = editando ? <>
    <button key="cancelar" type="button" className="txtbtn" onClick={onCancelar} disabled={busy}>Cancelar</button>
    <button key="guardar" type="submit" form="inv-form" className="btn primary" disabled={busy}>{busy ? <><span className="spin" aria-hidden="true" />A guardar…</> : <><Icon name="check" />Guardar</>}</button>
  </> : <>
    {onApagar && <button key="apagar" type="button" className="txtbtn danger inv-del" onClick={onApagar}><Icon name="trash" />Apagar</button>}
    <button key="editar" type="button" className="btn primary" onClick={onEditar}><Icon name="pencil-simple" />Editar</button>
  </>;
  return (
    <div ref={box} className={`inv-page${editando ? " ed" : ""}`}>
      <button type="button" className="txtbtn inv-back" onClick={editando ? onCancelar : onClose}><Icon name="caret-left" />{voltar}</button>
      <header className="inv-phd">
        <div className="inv-mh"><span className="inv-ref">{refTxt}</span><h1>{titulo || "Sem nome"}</h1>{!editando && tags && <div className="inv-tags">{tags}</div>}</div>
        <div className="inv-act">{acoes}</div>
      </header>
      <form id="inv-form" className="inv-body" onSubmit={guardar}>{editando ? edicao : leitura}</form>
      {editando && <div className="inv-bar" role="region" aria-label="Guardar alterações"><span className="mut">{onApagar ? "A editar" : "Novo"}: {titulo || "sem nome"}</span><span className="sp" />{acoes}</div>}
    </div>
  );
}

const fold = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Nome só com letras e números, para comparar «Candam Tech» com «CandamTech». */
export const chave = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");
const ondeEsta = (s: Startup) => s.status === "pending" ? "Triagem" : s.status === "rejected" ? "Arquivo de triagem" : s.dealId ? "Pipeline" : "Aprovada";

/** Escolher a startup parceira na base de dados, com pesquisa. Escrever sem escolher deixa o parceiro sem ligação. */
export function StartupPicker({ startups, startupId, nome, onPick, label = "Startup parceira", cls = "fld wide" }: {
  startups: Startup[]; startupId?: string; nome: string; onPick: (s: Startup | null, nomeLivre: string) => void; label?: string; cls?: string;
}) {
  const [q, setQ] = useState(nome);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const ligada = startups.find((s) => s.id === startupId);
  useEffect(() => { setQ(ligada?.nome || nome); }, [startupId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f);
  }, [open]);
  const lista = useMemo(() => {
    const k = fold(q.trim());
    const l = !k ? startups : startups.filter((s) => fold(`${s.nome} ${s.dominio}`).includes(k));
    return [...l].sort((a, b) => Number(!fold(a.nome).startsWith(k)) - Number(!fold(b.nome).startsWith(k)) || a.nome.localeCompare(b.nome)).slice(0, 40);
  }, [q, startups]);
  const escolher = (s: Startup) => { onPick(s, s.nome); setQ(s.nome); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(lista.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter" && open && lista[hi]) { e.preventDefault(); escolher(lista[hi]); }
    else if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setOpen(false); }
  };
  return (
    <div className={`${cls} inv-sp`} ref={box}>
      <span>{label}</span>
      <div className="inv-spi">
        <Icon name={ligada ? "check-circle" : "magnifying-glass"} className={ligada ? "ok" : ""} />
        <input value={q} placeholder="Procurar startup na base de dados" role="combobox" aria-expanded={open} aria-label={label} autoComplete="off"
          onClick={() => setOpen(true)} onKeyDown={onKey}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); onPick(null, e.target.value); }} />
        {ligada && <button type="button" className="inv-spx" aria-label="Tirar a ligação" title="Tirar a ligação à startup" onClick={() => onPick(null, q)}><Icon name="x" /></button>}
        {open && (
          <div className="inv-spl" role="listbox">
            {lista.map((s, i) => (
              <button type="button" role="option" key={s.id} aria-selected={s.id === startupId} className={`inv-spo${i === hi ? " hi" : ""}`}
                onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(s)}>
                <Logo nome={s.nome} logo={s.logo} /><b>{s.nome}</b><small>{s.dominio}</small><span className="sp" /><em>{ondeEsta(s)}</em>
              </button>))}
            {!lista.length && <p className="inv-spe">Nenhuma startup com «{q}». Fica como texto, sem ligação.</p>}
          </div>
        )}
      </div>
      <em className="inv-sph">{ligada ? `Ligada a «${ligada.nome}» (${ondeEsta(ligada)})` : q.trim() ? "Sem ligação: escolhe uma startup da lista" : "Escolhe uma startup da lista"}</em>
    </div>
  );
}
