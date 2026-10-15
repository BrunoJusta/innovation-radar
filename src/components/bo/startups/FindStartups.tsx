"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { createStartup, StartupEdit } from "@/lib/startup-actions";
import { FASES, Sector, Startup } from "@/lib/types";
import { nowIso } from "@/lib/util";
import { Icon } from "@/components/Icon";
import { useSession } from "../AuthGate";
import { StartupFields } from "./StartupFields";

type Cand = StartupEdit & { id: string; dominio: string; fonte: { titulo: string; url: string }; siteOk?: boolean };

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ erro: `Erro ${r.status}` }));
  if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
  return j as T;
}
const toEdit = (c: Cand): StartupEdit => ({ nome: c.nome, site: c.site, pais: c.pais, cidade: c.cidade || "", fundacao: c.fundacao, fase: c.fase, setor: c.setor,
  descricao: c.descricao, porque: c.porque, relevancia: c.relevancia, financiamento: c.financiamento, investidores: c.investidores });

/** Procurar startups online ou adicionar uma pelo site. Nada é gravado sem confirmação. */
export function FindStartups({ mode: m0, sectors, startups, onClose, onDone }: {
  mode: "search" | "site"; sectors: Sector[]; startups: Startup[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const { email } = useSession();
  const [mode, setMode] = useState(m0);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  // Procurar
  const [query, setQuery] = useState("");
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  // Por site
  const [site, setSite] = useState("");
  const [ficha, setFicha] = useState<{ c: Cand; e: StartupEdit } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [busy, onClose]);

  const exists = (id: string) => startups.find((s) => s.id === id);
  const secs = sectors.map(({ id, nome, descricao, cor, icone, ordem, pesquisas }) => ({ id, nome, descricao, cor, icone, ordem, pesquisas }));

  const procurar = async () => {
    if (query.trim().length < 3) { setErro("Escreve o que queres procurar."); return; }
    setErro(""); setBusy(true); setCands(null);
    try {
      const j = await post<{ candidatas: Cand[] }>("/api/startups/procurar", { query, sectors: secs });
      setCands(j.candidatas);
      setPick(new Set(j.candidatas.filter((c) => !exists(c.id) && c.siteOk !== false).map((c) => c.id)));
    } catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  };
  const enviar = async () => {
    const sel = (cands || []).filter((c) => pick.has(c.id));
    if (!sel.length) return;
    setBusy(true); setErro("");
    try {
      let novas = 0, juntas = 0;
      for (const c of sel) {
        const r = await createStartup(c.id, { ...toEdit(c), dominio: c.dominio }, { tipo: "pesquisa", titulo: c.fonte.titulo, url: c.fonte.url, data: nowIso(), pesquisa: query }, email);
        if (r === "criada") novas++; else juntas++;
      }
      onDone(`${novas} startup${novas === 1 ? "" : "s"} na triagem${juntas ? `, ${juntas} já existia${juntas === 1 ? "" : "m"}` : ""}`);
    } catch (e) { setErro((e as { code?: string }).code === "permission-denied" ? "Sem permissão para gravar. Confirma que as regras do Firestore estão atualizadas." : "Não foi possível guardar. Tenta outra vez."); setBusy(false); }
  };

  const preparar = async () => {
    setErro(""); setBusy(true);
    try {
      const j = await post<{ ficha: Cand; siteOk: boolean }>("/api/startups/ficha", { site, sectors: secs });
      setFicha({ c: { ...j.ficha, siteOk: j.siteOk }, e: toEdit(j.ficha) });
    } catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  };
  const guardar = async (aprovar: boolean) => {
    if (!ficha || !ficha.e.nome.trim()) return;
    setBusy(true); setErro("");
    try {
      const r = await createStartup(ficha.c.id, { ...ficha.e, dominio: ficha.c.dominio },
        { tipo: "manual", titulo: ficha.c.fonte.titulo || ficha.e.nome, url: ficha.c.fonte.url || ficha.e.site, data: nowIso() }, email, aprovar);
      onDone(r === "existia" ? `«${ficha.e.nome}» já existia; juntei a origem` : aprovar ? `«${ficha.e.nome}» aprovada e no radar` : `«${ficha.e.nome}» na triagem`);
    } catch (e) { setErro((e as { code?: string }).code === "permission-denied" ? "Sem permissão para gravar. Confirma que as regras do Firestore estão atualizadas." : "Não foi possível guardar. Tenta outra vez."); setBusy(false); }
  };

  const wide = (mode === "search" && cands) || (mode === "site" && ficha);
  return (<>
    <div className="scrim" onClick={() => !busy && onClose()} />
    <div className={`mdl${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="fs-t">
      <div className="mdl-h">
        <h2 id="fs-t">{ficha ? "Rever startup" : cands ? "Resultados da pesquisa" : "Adicionar startups"}</h2>
        <button className="btn icon" aria-label="Fechar" onClick={onClose} disabled={busy}><Icon name="x" /></button>
      </div>
      {!ficha && !cands && (
        <div className="mdl-tabs seg" role="group">
          <button aria-pressed={mode === "search"} onClick={() => { setMode("search"); setErro(""); }} disabled={busy}><Icon name="magnifying-glass" />Procurar online</button>
          <button aria-pressed={mode === "site"} onClick={() => { setMode("site"); setErro(""); }} disabled={busy}><Icon name="globe" />Pelo site</button>
        </div>
      )}

      {mode === "search" && (<>
        <div className={`mdl-b${cands ? " scroll" : ""}`}>
          <label className="fld"><span>O que procuras</span>
            <input autoFocus value={query} disabled={busy} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && procurar()}
              placeholder="ex.: startups de rótulos inteligentes para vinho" /></label>
          {!cands && <div className="sugs">{sectors.flatMap((s) => (s.pesquisas || []).slice(0, 1)).map((q) => <button key={q} className="chipf" onClick={() => setQuery(q)}>{q}</button>)}</div>}
          {!cands && <p className="hint">A Gemini pesquisa na web e propõe startups com site, fase e setor. Escolhes quais vão para a triagem.</p>}
          {cands && (cands.length === 0 ? <p className="hint">Não encontrei startups com site próprio para esta pesquisa. Tenta outras palavras.</p> : (
            <ul className="clist">
              {cands.map((c) => {
                const ex = exists(c.id), s = sectors.find((x) => x.id === c.setor);
                return (
                  <li key={c.id} className={pick.has(c.id) ? "on" : ""}>
                    <label>
                      <input type="checkbox" checked={pick.has(c.id)} onChange={() => { const n = new Set(pick); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setPick(n); }} />
                      <div className="cinfo">
                        <div className="cl1"><b>{c.nome}</b><a href={c.site} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{c.dominio}</a>
                          <span className="tg ar" style={{ ["--c" as string]: s?.cor || "var(--ink-tertiary)" }}>{s?.nome}</span><span className="tg">{FASES.find((f) => f.id === c.fase)?.nome}</span>
                          <span className="tg mn">{c.relevancia}</span></div>
                        <p>{c.descricao}</p>
                        {ex && <span className="cwarn">Já existe ({ex.status === "approved" ? "aprovada" : ex.status === "rejected" ? "rejeitada" : "em triagem"}). Se a enviares, só junto esta origem.</span>}
                        {c.siteOk === false && <span className="cwarn">O site não respondeu. Confirma antes de enviar.</span>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          ))}
          {erro && <p className="gerr" role="alert">{erro}</p>}
        </div>
        <div className="mdl-f">
          {cands && <button className="txtbtn" onClick={() => { setCands(null); setPick(new Set()); }} disabled={busy}><Icon name="arrow-u-up-left" />Nova pesquisa</button>}
          <span className="sp" />
          {!cands
            ? <button className="btn primary" onClick={procurar} disabled={busy}>{busy ? <><span className="spin" aria-hidden="true" />A pesquisar…</> : <><Icon name="sparkle" />Procurar</>}</button>
            : <button className="btn primary" onClick={enviar} disabled={busy || !pick.size}><Icon name="tray" />Enviar {pick.size || ""} para a triagem</button>}
        </div>
      </>)}

      {mode === "site" && (<>
        <div className={`mdl-b${ficha ? " scroll" : ""}`}>
          {!ficha ? (<>
            <label className="fld"><span>Site da startup</span>
              <input type="url" inputMode="url" autoFocus spellCheck={false} value={site} disabled={busy} onChange={(e) => setSite(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && preparar()} placeholder="startup.com" /></label>
            <p className="hint">A Gemini pesquisa a startup na web e prepara a ficha. Revês e editas tudo antes de gravar.</p>
          </>) : (<>
            {ficha.c.siteOk === false && <div className="notice warn"><Icon name="warning-circle" /><span>O site não respondeu. Confirma o endereço.</span></div>}
            {exists(ficha.c.id) && <div className="notice warn"><Icon name="warning-circle" /><span>Esta startup já existe. Se gravares, só junto esta origem à ficha que existe.</span></div>}
            <StartupFields value={ficha.e} onChange={(p) => setFicha({ ...ficha, e: { ...ficha.e, ...p } })} sectors={sectors} />
          </>)}
          {erro && <p className="gerr" role="alert">{erro}</p>}
        </div>
        <div className="mdl-f">
          {ficha && <button className="txtbtn" onClick={() => setFicha(null)} disabled={busy}><Icon name="arrow-u-up-left" />Outro site</button>}
          <span className="sp" />
          {!ficha
            ? <button className="btn primary" onClick={preparar} disabled={busy || !site.trim()}>{busy ? <><span className="spin" aria-hidden="true" />A pesquisar…</> : <><Icon name="sparkle" />Preparar ficha</>}</button>
            : <><button className="btn" onClick={() => guardar(false)} disabled={busy}><Icon name="tray" />Guardar na triagem</button>
                <button className="btn primary" onClick={() => guardar(true)} disabled={busy}><Icon name="check" />Aprovar</button></>}
        </div>
      </>)}
    </div>
  </>);
}
