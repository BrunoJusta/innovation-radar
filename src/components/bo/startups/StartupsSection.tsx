"use client";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, writeBatch } from "firebase/firestore";
import { post } from "@/lib/api";
import { useConfirm } from "../Confirm";
import { errMsg, useFlash } from "../admin/common";
import { db } from "@/lib/firebase";
import { Area, Deal, Fila, Sector, Startup, Status, emCurso } from "@/lib/types";
import { useAreas } from "@/lib/use-areas";
import { Icon } from "@/components/Icon";
import { StartupsTriage } from "./StartupsTriage";
import { StartupRadar } from "./StartupRadar";
import { SearchField } from "../ui";
import { DealsLookup, useDeals } from "../pipeline/DealsLookup";
import { PipelineSection } from "../pipeline/PipelineSection";
import { ReviewView } from "./ReviewView";
import { useSession } from "../AuthGate";
import type { Loc, PipeEstado } from "@/lib/localizacao";

/** Secção Startups do backoffice: Triagem, Aprovadas, Arquivo de triagem, (admins) Pipeline, Radar e Review. */
type Page = Status | "radar" | "pipeline" | "review";
/**
 * loc: a página onde abre (e o item a abrir, quando vem da pesquisa global). onLoc: avisa o backoffice quando muda de página
 * cá dentro, para o histórico e os breadcrumbs.
 */
export function StartupsSection({ loc, onLoc }: { loc: Loc; onLoc: (p: Partial<Loc>) => void }) {
  return <DealsLookup><Section loc={loc} onLoc={onLoc} /></DealsLookup>;
}

function Section({ loc, onLoc }: { loc: Loc; onLoc: (p: Partial<Loc>) => void }) {
  const { deals } = useDeals();
  const { canPipeline } = useSession();
  const initial: Page = loc.st || "pending";
  const [page, setPageS] = useState<Page>((initial === "pipeline" || initial === "review") && !canPipeline ? "approved" : initial);
  const setPage = (p: Page) => { setPageS(p); onLoc({ st: p, pipe: undefined }); };
  const foco = loc.foco;
  const [startups, setStartups] = useState<Startup[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Vindo da pesquisa global: a lista abre filtrada pelo nome
  const [search, setSearch] = useState(foco?.nome || "");
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const u1 = onSnapshot(collection(db, "startups"), (s) => { setStartups(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Startup)); setLoaded(true); },
      (e) => { console.error(e); setLoaded(true); });
    const u2 = onSnapshot(query(collection(db, "sectors"), orderBy("ordem")), (s) => setSectors(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Sector)));
    return () => { u1(); u2(); };
  }, []);
  // Cadeias de valor (os anéis do radar); enquanto a coleção não carrega, as da taxonomia
  const areas: Area[] = useAreas();
  // As aprovadas que passaram para o pipeline saem da lista de Aprovadas (continuam aprovadas na base de dados e no radar)
  const noPipe = new Set(deals.map((d) => d.startupId).filter(Boolean));
  const lista = startups.filter((s) => !(s.status === "approved" && (s.dealId || noPipe.has(s.id))));
  const cnt = (st: Status) => lista.filter((s) => s.status === st).length;
  const TABS: { id: Status; label: string; icon: string }[] = [
    { id: "pending", label: "Triagem", icon: "tray" }, { id: "approved", label: "Aprovadas", icon: "check-circle" }
  ];
  const Tab = ({ t }: { t: (typeof TABS)[number] }) => (
    <button key={t.id} aria-current={page === t.id || (t.id === "pending" && page === "rejected")} onClick={() => setPage(t.id)}><Icon name={t.icon} />{t.label}
      {cnt(t.id) > 0 && <span className={t.id === "pending" ? "c" : "c soft"}>{cnt(t.id)}</span>}</button>
  );
  return (<>
    <div className="pagebar">
      <nav className="subnav" aria-label="Startups">
        {TABS.map((t) => Tab({ t }))}
        {canPipeline && <button aria-current={page === "pipeline"} onClick={() => setPage("pipeline")}><Icon name="kanban" />Pipeline<PipeCount /></button>}
        <button aria-current={page === "radar"} onClick={() => setPage("radar")}><Icon name="globe" />Radar</button>
        {canPipeline && <button aria-current={page === "review"} onClick={() => setPage("review")}><Icon name="chart-line" />Review</button>}
      </nav>
      {page !== "radar" && page !== "review" && (
        <div className="pageact">
          <SearchField value={search} onChange={setSearch} placeholder={page === "pipeline" ? "Pesquisar no pipeline" : "Pesquisar startups"} />
          <AtribuirCategorias startups={startups} sectors={sectors} deals={canPipeline ? deals : []} />
          {page !== "pipeline" && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Adicionar startups</button>}
        </div>
      )}
    </div>
    {page === "review" ? <ReviewView startups={startups} sectors={sectors} areas={areas} />
      : page === "pipeline" ? <PipelineSection search={search} estado0={loc.pipe} abrir={foco?.id} onEstado={(e: PipeEstado) => onLoc({ st: "pipeline", pipe: e })} />
      : page !== "radar" ? <StartupsTriage areas={areas} status={page as Status} onStatus={setPage} startups={lista} sectors={sectors} loaded={loaded} search={search} adding={adding} setAdding={setAdding} abrir={foco?.id} />
      : <StartupRadar areas={areas} startups={startups} sectors={sectors} loaded={loaded} />}
  </>);
}

/** Número de startups em curso no pipeline (no separador). */
function PipeCount() {
  const { deals } = useDeals();
  const n = deals.filter((d) => emCurso(d.etapa)).length;
  return n ? <span className="c soft">{n}</span> : null;
}

/**
 * Atribui com a Gemini uma categoria às startups que não têm (ou têm uma que já não existe), e aos deals do pipeline sem categoria:
 * os ligados a uma ficha ficam com a categoria dela, os outros são classificados pela descrição.
 */
function AtribuirCategorias({ startups, sectors, deals }: { startups: Startup[]; sectors: Sector[]; deals: Deal[] }) {
  const { confirmar, el: cfEl } = useConfirm();
  const { flash, el } = useFlash();
  const [prog, setProg] = useState<{ feitas: number; total: number } | null>(null);
  const valida = (c?: string) => !!c && sectors.some((x) => x.id === c);
  const st = startups.filter((s) => s.nome && !valida(s.setor));
  const stIds = new Set(startups.map((s) => s.id));
  const dl = deals.filter((d) => d.nome && !valida(d.categoria));
  const soltos = dl.filter((d) => !d.startupId || !stIds.has(d.startupId));
  const total = st.length + soltos.length;
  if (!sectors.length || (!total && !dl.length)) return null;
  const atribuir = async () => {
    if (!(await confirmar({ titulo: `Atribuir categoria a ${total === 1 ? "1 startup" : `${total} startups`} sem categoria?`, texto: "A Gemini classifica pela descrição só as startups que ainda não têm categoria. As outras ficam como estão.", ok: "Atribuir" }))) return;
    const cats = sectors.map(({ id, nome, descricao }) => ({ id, nome, descricao }));
    const itens = [...st.map((s) => ({ id: s.id, nome: s.nome, descricao: s.descricao || s.nome })), ...soltos.map((d) => ({ id: `deal:${d.id}`, nome: d.nome, descricao: d.descricao || d.nome }))];
    const res: Record<string, string> = {};
    setProg({ feitas: 0, total: itens.length });
    try {
      for (let i = 0; i < itens.length; i += 80) {
        const lote = itens.slice(i, i + 80);
        const j = await post<{ setores: Record<string, string> }>("/api/startups/setores", { startups: lote, sectors: cats });
        Object.assign(res, j.setores);
        const b = writeBatch(db);
        for (const x of lote) if (valida(res[x.id]) && !x.id.startsWith("deal:")) b.update(doc(db, "startups", x.id), { setor: res[x.id] });
        await b.commit();
        setProg({ feitas: Math.min(i + 80, itens.length), total: itens.length });
      }
      // Deals sem categoria: herdam a da ficha (nova ou a que já tinha) ou a que a Gemini deu
      const setorDe = new Map(startups.map((s) => [s.id, res[s.id] || s.setor]));
      for (let i = 0; i < dl.length; i += 400) {
        const b = writeBatch(db);
        let n = 0;
        for (const d of dl.slice(i, i + 400)) { const c = (d.startupId && setorDe.get(d.startupId)) || res[`deal:${d.id}`]; if (valida(c)) { b.update(doc(db, "deals", d.id), { categoria: c }); n++; } }
        if (n) await b.commit();
      }
      flash(`Categoria atribuída a ${Object.keys(res).filter((k) => valida(res[k])).length} de ${itens.length} startups`);
    } catch (e) { flash((e as Error).message || errMsg(e)); }
    setProg(null);
  };
  return (<>
    <button className="btn" onClick={atribuir} disabled={!!prog} title="Atribuir com a Gemini uma categoria às startups sem categoria">
      {prog ? <><span className="spin" aria-hidden="true" />{prog.feitas} de {prog.total}</> : <><Icon name="sparkle" />Atribuir categorias{total > 0 ? ` (${total})` : ""}</>}</button>
    {cfEl}{el}
  </>);
}
