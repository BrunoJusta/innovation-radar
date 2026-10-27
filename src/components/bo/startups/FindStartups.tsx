"use client";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { post as postApi } from "@/lib/api";
import { createStartup, saveStartupLink, StartupEdit } from "@/lib/startup-actions";
import { createDeal, dealFromStartup, findDeal } from "@/lib/deal-actions";
import { Area, FASES, Sector, Startup, STARTUP_SITES } from "@/lib/types";
import { hojeLocal, nowIso, slug } from "@/lib/util";
import { useDeals } from "../pipeline/DealsLookup";
import { Icon } from "@/components/Icon";
import { useSession } from "../AuthGate";
import { StartupFields } from "./StartupFields";
import { useAnaliseQueue } from "../AnaliseQueue";
import { procurarEGuardar } from "@/lib/logo";
import { cadeiasParaApi } from "@/lib/use-areas";

type Cand = StartupEdit & { id: string; dominio: string; fonte: { titulo: string; url: string }; siteOk?: boolean };

const post = <T,>(path: string, body: unknown) => postApi<T>(path, body,
  "A pesquisa demorou demasiado e foi interrompida. Tenta outra vez ou usa uma pesquisa mais concreta (tema + tipo de empresa).");
const toEdit = (c: Cand): StartupEdit => ({ nome: c.nome, site: c.site, pais: c.pais, cidade: c.cidade || "", fundacao: c.fundacao, fase: c.fase, setor: c.setor, cadeia: c.cadeia,
  descricao: c.descricao, porque: c.porque, relevancia: c.relevancia, financiamento: c.financiamento, investidores: c.investidores });

/** Domínio de um site («https://www.x.com/a» → «x.com»). */
const dominioDe = (site: string) => site.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
type Lite = { nome: string; site: string; pais: string; cadeia: string; setor: string; fase: Startup["fase"]; descricao: string; porque: string; destino: "pending" | "approved" | "pipeline" };
const LITE_VAZIA: Lite = { nome: "", site: "", pais: "", cadeia: "", setor: "", fase: "seed", descricao: "", porque: "", destino: "pending" };

/** Procurar startups online, adicionar uma pelo site ou à mão (versão rápida, sem pesquisa). Nada é gravado sem confirmação. */
export function FindStartups({ mode: m0, sectors, areas, startups, onClose, onDone }: {
  mode: "search" | "site" | "rapida"; sectors: Sector[]; areas: Area[]; startups: Startup[]; onClose: () => void;
  /** onde: para onde foi a startup adicionada à mão (as outras formas vão sempre para a triagem ou para as aprovadas). */
  onDone: (msg: string, onde?: "pending" | "approved" | "pipeline") => void;
}) {
  const { email, canPipeline } = useSession();
  const { deals } = useDeals();
  const [mode, setMode] = useState(m0);
  const { queue } = useAnaliseQueue();
  const [analisar, setAnalisar] = useState(true);
  const setorNome = (id: string) => sectors.find((x) => x.id === id)?.nome || "";
  const analisa = (id: string, e: StartupEdit, dominio: string) => queue({ path: `startups/${id}`, nome: e.nome, site: e.site, dominio, descricao: e.descricao, setor: setorNome(e.setor) });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  // Procurar
  const [query, setQuery] = useState("");
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  // À mão (versão rápida)
  const [lite, setLite] = useState<Lite>(LITE_VAZIA);
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
  const liteId = lite.site.trim() ? dominioDe(lite.site).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : lite.nome.trim() ? `m-${slug(lite.nome)}` : "";
  const liteExiste = liteId ? exists(liteId) || startups.find((x) => slug(x.nome) === slug(lite.nome)) : undefined;
  const [sites, setSites] = useState<string[]>(STARTUP_SITES);
  useEffect(() => { getDoc(doc(db, "settings", "geral")).then((d) => { const v = d.data()?.sitesStartups; if (Array.isArray(v)) setSites(v); }).catch(() => {}); }, []);
  const secs = sectors.map(({ id, nome, descricao, cor, icone, ordem, pesquisas }) => ({ id, nome, descricao, cor, icone, ordem, pesquisas }));

  const procurar = async () => {
    if (query.trim().length < 3) { setErro("Escreve o que queres procurar."); return; }
    setErro(""); setBusy(true); setCands(null);
    try {
      const j = await post<{ candidatas: Cand[] }>("/api/startups/procurar", { query, sectors: secs, sites, cadeias: cadeiasParaApi(areas) });
      setCands(j.candidatas);
      setPick(new Set(j.candidatas.filter((c) => !exists(c.id)).map((c) => c.id)));
      // Verificação dos sites em segundo plano: avisa e desmarca os que não respondem
      if (j.candidatas.length) post<{ ok: Record<string, boolean> }>("/api/startups/verificar", { sites: j.candidatas.map((c) => c.site) })
        .then((v) => {
          setCands((cs) => cs && cs.map((c) => ({ ...c, siteOk: v.ok[c.site] })));
          setPick((p) => new Set([...p].filter((id) => v.ok[j.candidatas.find((c) => c.id === id)?.site || ""] !== false)));
        }).catch(() => { /* sem verificação: segue sem avisos */ });
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
        if (r === "criada") { novas++; procurarEGuardar(c.site, { startupId: c.id }); if (analisar) analisa(c.id, toEdit(c), c.dominio); } else juntas++;
      }
      onDone(`${novas} startup${novas === 1 ? "" : "s"} na triagem${juntas ? `, ${juntas} já existia${juntas === 1 ? "" : "m"}` : ""}${analisar && novas ? ". A análise de investimento corre em segundo plano." : ""}`);
    } catch (e) { setErro((e as { code?: string }).code === "permission-denied" ? "Sem permissão para gravar. Confirma que as regras do Firestore estão atualizadas." : "Não foi possível guardar. Tenta outra vez."); setBusy(false); }
  };

  const preparar = async () => {
    setErro(""); setBusy(true);
    try {
      const j = await post<{ ficha: Cand; siteOk: boolean }>("/api/startups/ficha", { site, sectors: secs, cadeias: cadeiasParaApi(areas) });
      setFicha({ c: { ...j.ficha, siteOk: j.siteOk }, e: toEdit(j.ficha) });
    } catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  };
  const guardar = async (aprovar: boolean) => {
    if (!ficha || !ficha.e.nome.trim()) return;
    setBusy(true); setErro("");
    try {
      const r = await createStartup(ficha.c.id, { ...ficha.e, dominio: ficha.c.dominio },
        { tipo: "manual", titulo: ficha.c.fonte.titulo || ficha.e.nome, url: ficha.c.fonte.url || ficha.e.site, data: nowIso() }, email, aprovar);
      if (r === "criada") procurarEGuardar(ficha.e.site, { startupId: ficha.c.id });
      if (r === "criada" && analisar) analisa(ficha.c.id, ficha.e, ficha.c.dominio);
      const extra = r === "criada" && analisar ? ". A análise de investimento corre em segundo plano." : "";
      onDone(r === "existia" ? `«${ficha.e.nome}» já existia; juntei a origem` : (aprovar ? `«${ficha.e.nome}» aprovada` : `«${ficha.e.nome}» na triagem`) + extra);
    } catch (e) { setErro((e as { code?: string }).code === "permission-denied" ? "Sem permissão para gravar. Confirma que as regras do Firestore estão atualizadas." : "Não foi possível guardar. Tenta outra vez."); setBusy(false); }
  };

  /** Versão rápida: grava só o que se sabe, sem pesquisa na web. Pode ir para a triagem, para as aprovadas ou direto para o pipeline. */
  const guardarLite = async () => {
    const nome = lite.nome.trim();
    if (!nome) { setErro("Indica o nome da startup."); return; }
    if (liteExiste) { setErro(`«${liteExiste.nome}» já existe. Procura-a na pesquisa da barra de cima.`); return; }
    setBusy(true); setErro("");
    const site = lite.site.trim() ? (/^https?:\/\//i.test(lite.site.trim()) ? lite.site.trim() : `https://${lite.site.trim()}`) : "";
    const dominio = site ? dominioDe(site) : "";
    const e: StartupEdit = { nome, site, pais: lite.pais.trim(), cidade: "", fundacao: null, fase: lite.fase, setor: lite.setor, cadeia: lite.cadeia || undefined,
      descricao: lite.descricao.trim(), porque: lite.porque.trim(), relevancia: 50, financiamento: "", investidores: [] };
    try {
      const aprovar = lite.destino !== "pending";
      await createStartup(liteId, { ...e, dominio }, { tipo: "manual", titulo: "Adicionada à mão (versão rápida)", url: site, data: nowIso() }, email, aprovar);
      if (site) procurarEGuardar(site, { startupId: liteId });
      if (lite.destino === "pipeline") {
        const st = { ...e, id: liteId, dominio, status: "approved", destaque: false, origens: [], criadoEm: nowIso(), atualizadoEm: nowIso() } as Startup;
        if (!findDeal(deals, st)) {
          const dealId = await createDeal({ ...dealFromStartup(st, deals, setorNome(e.setor)), origem: { tipo: "rede", nome: "Adicionada à mão", contacto: "" }, entrada: hojeLocal() }, email, "Adicionada à mão (versão rápida).");
          await saveStartupLink(liteId, dealId);
        }
      }
      onDone(lite.destino === "pipeline" ? `«${nome}» entrou no pipeline em Validation Fit` : lite.destino === "approved" ? `«${nome}» aprovada` : `«${nome}» na triagem`, lite.destino);
    } catch (er) { setErro((er as { code?: string }).code === "permission-denied" ? "Sem permissão para gravar. Confirma que as regras do Firestore estão atualizadas." : "Não foi possível guardar. Tenta outra vez."); setBusy(false); }
  };

  const wide = (mode === "search" && cands) || (mode === "site" && ficha);
  return (<>
    <div className="scrim" onClick={() => !busy && onClose()} />
    <div className={`mdl${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="fs-t">
      <div className="mdl-h">
        <h2 id="fs-t">{ficha ? "Rever startup" : cands ? "Resultados da pesquisa" : mode === "rapida" ? "Adicionar à mão" : "Adicionar startups"}</h2>
        <button className="btn icon" aria-label="Fechar" onClick={onClose} disabled={busy}><Icon name="x" /></button>
      </div>
      {!ficha && !cands && (
        <div className="mdl-tabs seg" role="group">
          <button aria-pressed={mode === "search"} onClick={() => { setMode("search"); setErro(""); }} disabled={busy}><Icon name="magnifying-glass" />Procurar online</button>
          <button aria-pressed={mode === "site"} onClick={() => { setMode("site"); setErro(""); }} disabled={busy}><Icon name="globe" />Pelo site</button>
          <button aria-pressed={mode === "rapida"} onClick={() => { setMode("rapida"); setErro(""); }} disabled={busy}><Icon name="pencil-simple" />À mão</button>
        </div>
      )}

      {mode === "search" && (<>
        <div className={`mdl-b${cands ? " scroll" : ""}`}>
          <label className="fld"><span>O que procuras</span>
            <input autoFocus value={query} disabled={busy} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && procurar()}
              placeholder="ex.: startups de rótulos inteligentes para vinho" /></label>
          {!cands && <div className="sugs">{sectors.flatMap((s) => (s.pesquisas || []).slice(0, 1)).map((q) => <button key={q} className="chipf" onClick={() => setQuery(q)}>{q}</button>)}</div>}
          {!cands && <p className="hint">A Gemini pesquisa na web e propõe startups com site, fase, categoria e cadeia de valor. Demora normalmente 15 a 40 segundos. Escolhes quais vão para a triagem.</p>}
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
          {cands && cands.length > 0 && <label className="anchk" title="Avalia com os critérios da Sogrape Ventures depois de gravar (cerca de 1 minuto por startup)"><input type="checkbox" checked={analisar} onChange={(e) => setAnalisar(e.target.checked)} />Fazer análise de investimento</label>}
          {!cands
            ? <button className="btn primary" onClick={procurar} disabled={busy}>{busy ? <><span className="spin" aria-hidden="true" />A pesquisar na web…</> : <><Icon name="sparkle" />Procurar</>}</button>
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
            <StartupFields value={ficha.e} onChange={(p) => setFicha({ ...ficha, e: { ...ficha.e, ...p } })} sectors={sectors} areas={areas} />
          </>)}
          {erro && <p className="gerr" role="alert">{erro}</p>}
        </div>
        <div className="mdl-f">
          {ficha && <button className="txtbtn" onClick={() => setFicha(null)} disabled={busy}><Icon name="arrow-u-up-left" />Outro site</button>}
          <span className="sp" />
          {ficha && <label className="anchk" title="Avalia com os critérios da Sogrape Ventures depois de gravar (cerca de 1 minuto por startup)"><input type="checkbox" checked={analisar} onChange={(e) => setAnalisar(e.target.checked)} />Fazer análise de investimento</label>}
          {!ficha
            ? <button className="btn primary" onClick={preparar} disabled={busy || !site.trim()}>{busy ? <><span className="spin" aria-hidden="true" />A pesquisar…</> : <><Icon name="sparkle" />Preparar ficha</>}</button>
            : <><button className="btn" onClick={() => guardar(false)} disabled={busy}><Icon name="tray" />Guardar na triagem</button>
                <button className="btn primary" onClick={() => guardar(true)} disabled={busy}><Icon name="check" />Aprovar</button></>}
        </div>
      </>)}

      {mode === "rapida" && (<>
        <div className="mdl-b scroll">
          <p className="hint">Para startups que já conhecemos mas de que ainda há pouca informação. Só o nome é obrigatório; o resto completa-se mais tarde na ficha. Não faz pesquisa na web.</p>
          <div className="fgrid lite">
            <label className="fld"><span>Nome</span><input autoFocus autoComplete="off" value={lite.nome} disabled={busy} onChange={(e) => setLite({ ...lite, nome: e.target.value })} /></label>
            <label className="fld"><span>Site <em>(opcional)</em></span><input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="startup.com" value={lite.site} disabled={busy} onChange={(e) => setLite({ ...lite, site: e.target.value })} /></label>
            <label className="fld"><span>País</span><input autoComplete="off" value={lite.pais} disabled={busy} onChange={(e) => setLite({ ...lite, pais: e.target.value })} /></label>
            <label className="fld"><span>Fase</span><select value={lite.fase} disabled={busy} onChange={(e) => setLite({ ...lite, fase: e.target.value as Lite["fase"] })}>{FASES.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
            <label className="fld"><span>Cadeia de valor</span><select value={lite.cadeia} disabled={busy} onChange={(e) => setLite({ ...lite, cadeia: e.target.value })}>
              <option value="">Por atribuir</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
            <label className="fld"><span>Categoria</span><select value={lite.setor} disabled={busy} onChange={(e) => setLite({ ...lite, setor: e.target.value })}>
              <option value="">Sem categoria</option>{sectors.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
          </div>
          <label className="fld full"><span>O que faz <em>(opcional)</em></span><textarea rows={3} value={lite.descricao} disabled={busy} onChange={(e) => setLite({ ...lite, descricao: e.target.value })} /></label>
          <label className="fld full"><span>Como a conhecemos <em>(opcional)</em></span><textarea rows={2} value={lite.porque} disabled={busy} placeholder="ex.: falámos com os fundadores na Vinexpo" onChange={(e) => setLite({ ...lite, porque: e.target.value })} /></label>
          <div className="fld"><span>Onde entra</span>
            <div className="seg" role="group" aria-label="Onde entra">
              <button type="button" aria-pressed={lite.destino === "pending"} onClick={() => setLite({ ...lite, destino: "pending" })} disabled={busy}><Icon name="tray" />Triagem</button>
              <button type="button" aria-pressed={lite.destino === "approved"} onClick={() => setLite({ ...lite, destino: "approved" })} disabled={busy}><Icon name="check-circle" />Aprovadas</button>
              {canPipeline && <button type="button" aria-pressed={lite.destino === "pipeline"} onClick={() => setLite({ ...lite, destino: "pipeline" })} disabled={busy}><Icon name="kanban" />Pipeline</button>}
            </div></div>
          {liteExiste && <div className="notice warn"><Icon name="warning-circle" /><span>Já existe uma startup com este {lite.site.trim() ? "site" : "nome"}: «{liteExiste.nome}».</span></div>}
          {erro && <p className="gerr" role="alert">{erro}</p>}
        </div>
        <div className="mdl-f">
          <span className="sp" />
          <button className="btn primary" onClick={guardarLite} disabled={busy || !lite.nome.trim() || !!liteExiste}>
            {busy ? <><span className="spin" aria-hidden="true" />A guardar…</> : <><Icon name="check" />{lite.destino === "pipeline" ? "Pôr no pipeline" : lite.destino === "approved" ? "Guardar nas aprovadas" : "Guardar na triagem"}</>}</button>
        </div>
      </>)}
    </div>
  </>);
}
