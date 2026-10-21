"use client";
import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { lerFolha, type Celula } from "@/lib/xlsx-lite";
import { Icon } from "@/components/Icon";

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
