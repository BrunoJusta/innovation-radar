"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, deleteField, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@/components/Icon";
import { lerFolha, type Celula } from "@/lib/xlsx-lite";
import { addInteracao, createDeal, dealFromStartup, dealParaAprovadas, esperaDe, moveDeal, saveDeal } from "@/lib/deal-actions";
import { saveStartupLink } from "@/lib/startup-actions";
import { Deal, Sector, Startup, Status, emCurso } from "@/lib/types";
import { hojeLocal, nowIso } from "@/lib/util";
import {
  LinhaSV, Passo, converterRadarSV, fasesDeSV, motivoArquivoDeSV, motivoTriagemDeSV, origemDeSV, planear, startupDoExcel, verticalDfDeSV,
} from "@/lib/import-radar-sv";
import { useSession } from "../AuthGate";
import { useDeals } from "../pipeline/DealsLookup";

const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/** Lê a primeira folha com «Startup Name» no cabeçalho (normalmente a do ano, ex.: «2026»). */
async function lerExcel(f: File): Promise<Celula[][]> {
  const buf = await f.arrayBuffer();
  const ano = String(new Date().getFullYear());
  for (const nome of [ano, String(+ano - 1), "Radar", "Dealflow", "Sheet1", "Folha1"]) {
    try { const r = await lerFolha(buf, nome); if (r.some((x) => (x || []).some((c) => String(c ?? "").trim().toLowerCase() === "startup name"))) return r; } catch { /* outra folha */ }
  }
  throw new Error(`Não encontrei a folha das startups (procurei «${ano}», «${+ano - 1}» e «Radar»).`);
}

/** Tira uma startup do pipeline: apaga a ficha do pipeline com a cronologia e as análises do deal. */
async function apagarDeal(d: Deal) {
  for (const sub of ["interacoes", "analises"]) {
    const l = await getDocs(collection(db, "deals", d.id, sub));
    await Promise.all(l.docs.map((x) => deleteDoc(x.ref)));
  }
  await deleteDoc(doc(db, "deals", d.id));
}

const Onde = ({ o }: { o: string[] | null }) => o ? <span className="isv-onde">{o.map((x, i) => <span key={i}>{i > 0 && <Icon name="caret-right" />}{x}</span>)}</span> : <span className="mut">Não existe</span>;

/**
 * Botão provisório: importa o Excel «Radar Sogrape Ventures» e põe cada startup no sítio que a coluna «Categorização» indica.
 * As que já existem só mudam de localização (o resto da ficha fica como está); as que não existem são criadas com os dados do Excel.
 */
export function ImportRadarSV({ startups, sectors, onClose, onDone }: { startups: Startup[]; sectors: Sector[]; onClose: () => void; onDone: (msg: string) => void }) {
  const { email } = useSession();
  const { deals } = useDeals();
  const [linhas, setLinhas] = useState<LinhaSV[] | null>(null);
  const [ficheiro, setFicheiro] = useState("");
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const [estado, setEstado] = useState<"rever" | "aplicar" | "feito">("rever");
  const [tudo, setTudo] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [falhas, setFalhas] = useState<string[]>([]);
  const parar = useRef(false);
  const busy = estado === "aplicar";

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [busy, onClose]);

  const ler = async (f: File | undefined) => {
    if (!f) return;
    setErro(""); setLendo(true); setFicheiro(f.name);
    try {
      const l = converterRadarSV(await lerExcel(f));
      if (!l.length) throw new Error("O Excel não tem startups.");
      setLinhas(l);
    } catch (e) { setErro((e as Error).message || "Não foi possível ler o ficheiro."); setLinhas(null); }
    setLendo(false);
  };

  // O plano usa a fotografia de quando se carrega o ficheiro (as mudanças em tempo real não o refazem a meio)
  const plano = useMemo(() => (linhas ? planear(linhas, startups, deals) : []), [linhas]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = (a: Passo["acao"]) => plano.filter((p) => p.acao === a).length;
  const aFazer = plano.filter((p) => p.acao === "criar" || p.acao === "mover");
  const saemDoPipeline = aFazer.filter((p) => p.deal && p.l.destino?.tipo === "triagem");
  const vistos = tudo ? plano : plano.filter((p) => p.acao !== "igual");

  const aplicar = async () => {
    setEstado("aplicar"); setFeitas(0); setFalhas([]); parar.current = false;
    const agora = nowIso(), hoje = hojeLocal();
    const dealsLocal: Deal[] = [...deals];
    const setorNome = (id: string) => sectors.find((x) => x.id === id)?.nome || "";

    /** Startup aprovada (ou no estado pedido): a que existe ou uma nova com os dados do Excel. */
    /** extra: campos a juntar (os próximos passos em espera de quem sai do pipeline). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const garantirStartup = async (p: Passo, status: Status, manterPipeline: boolean, extra: Record<string, any> = {}): Promise<Startup> => {
      const quando = p.l.data ? `${p.l.data}T12:00:00.000Z` : agora;
      if (p.st) {
        const s = p.st;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const upd: Record<string, any> = { status, atualizadoEm: agora };
        if (status === "approved" && s.status !== "approved") Object.assign(upd, { aprovadoEm: quando, aprovadoPor: email });
        if (status === "rejected") upd.motivoRejeicao = s.motivoRejeicao || motivoTriagemDeSV(p.l.decisao); else upd.motivoRejeicao = deleteField();
        if (!manterPipeline) Object.assign(upd, { dealId: deleteField(), pipelineEm: deleteField() });
        Object.assign(upd, extra);
        await updateDoc(doc(db, "startups", s.id), upd);
        return { ...s, status };
      }
      const { id, ...data } = startupDoExcel(p.l, status, email, agora);
      const existe = startups.find((x) => x.id === id);
      if (existe) { await updateDoc(doc(db, "startups", id), { status, atualizadoEm: agora, ...extra }); return { ...existe, status }; }
      await setDoc(doc(db, "startups", id), clean({ ...data, ...extra }));
      return { id, ...data, ...extra } as Startup;
    };

    const umPasso = async (p: Passo) => {
      const l = p.l, dest = l.destino!;
      const quando = l.dataDecisao || l.data || hoje;
      const nota = [l.proximos, l.feedback].filter(Boolean).join(" ");
      if (dest.tipo === "triagem") {
        if (p.deal && dest.status === "approved") {
          // Sai do pipeline para as Aprovadas (liga primeiro a ficha certa, para não criar uma repetida)
          const d = p.st && p.deal.startupId !== p.st.id ? { ...p.deal, startupId: p.st.id } : p.deal;
          await dealParaAprovadas(d, email);
          return;
        }
        // Os próximos passos em aberto ficam em espera na ficha da startup (não se perdem com a ficha do pipeline)
        const espera = p.deal ? esperaDe(p.deal) : null;
        if (p.deal) await apagarDeal(p.deal);
        await garantirStartup(p, dest.status, false, espera ? { passosEmEspera: espera } : {});
        return;
      }
      // Pipeline: a startup fica aprovada e ligada à ficha do pipeline
      const st = await garantirStartup(p, "approved", true);
      const etapa = dest.etapa;
      if (p.deal) {
        const d = p.deal;
        if (d.etapa !== etapa) {
          if (etapa === "arquivada") {
            await saveDeal(d, { etapa, etapaDesde: quando, vez: null, proximaAcao: "", prazo: null,
              arquivo: { motivo: motivoArquivoDeSV(nota), nota, em: quando, etapaAnterior: emCurso(d.etapa) ? d.etapa : d.etapaAnterior || d.arquivo?.etapaAnterior || null } });
            await addInteracao(d.id, { data: hoje, tipo: "etapa", texto: `Arquivada pelo Excel do Radar Sogrape Ventures${nota ? `: ${nota}` : ""}`, por: email });
          } else await moveDeal(d, etapa, email);
        }
        if (d.startupId !== st.id) await saveDeal(d, { startupId: st.id });
        await saveStartupLink(st.id, d.id);
        return;
      }
      const { faseDF } = fasesDeSV(l.ciclo);
      const novo: Omit<Deal, "id"> = {
        ...dealFromStartup(st, dealsLocal, setorNome(st.setor)),
        fase: faseDF, vertical: verticalDfDeSV(l), entrada: l.data || hoje, etapa, etapaDesde: quando, origem: origemDeSV(l.fonte), importado: true,
        ...(etapa === "arquivada" ? { arquivo: { motivo: motivoArquivoDeSV(nota), nota, em: quando, etapaAnterior: "fit" as const }, vez: null, proximaAcao: "", prazo: null, passos: [] } : {}),
        ...(etapa === "investida" ? { vez: null, proximaAcao: "", prazo: null, passos: [], etapaAnterior: null } : {}),
        ...(etapa === "radar" ? { etapaAnterior: "fit" as const } : {}),
      };
      const id = await createDeal(novo, email, "Importada do Excel do Radar Sogrape Ventures.");
      dealsLocal.push({ ...novo, id } as Deal);
      await saveStartupLink(st.id, id);
      if (l.feedback) await addInteracao(id, { data: quando, tipo: "nota", texto: l.feedback, por: "Excel" });
      if (l.proximos) await addInteracao(id, { data: quando, tipo: "nota", texto: l.proximos, por: "Excel" });
    };

    for (const p of aFazer) {
      if (parar.current) break;
      try { await umPasso(p); }
      catch (e) { setFalhas((x) => [...x, `${p.l.nome}: ${(e as { code?: string }).code === "permission-denied" ? "sem permissão para gravar" : (e as Error).message?.slice(0, 80) || "erro"}`]); }
      setFeitas((x) => x + 1);
    }
    setEstado("feito");
  };

  const total = aFazer.length;
  const pct = total ? Math.round((feitas / total) * 100) : 0;

  return (<>
    <div className="scrim" onClick={() => !busy && onClose()} />
    <div className="mdl wide" role="dialog" aria-modal="true" aria-labelledby="isv-t">
      <div className="mdl-h">
        <div><h2 id="isv-t">Importar o Excel do Radar Sogrape Ventures</h2><span className="mdl-sub">Provisório: corrige a localização das startups</span></div>
        <button className="btn icon" aria-label="Fechar" onClick={onClose} disabled={busy}><Icon name="x" /></button>
      </div>
      <div className="mdl-b scroll">
        {estado === "rever" && (<>
          <p className="hint">Cada startup vai para o sítio que a coluna «Categorização» indica (Arquivo de triagem, Aprovada, Validation Fit, Radar, Arquivo de pipeline…). As que já existem só mudam de sítio; o resto da ficha fica como está. As que não existem são criadas com os dados do Excel. Nada é gravado antes de carregares em Aplicar.</p>
          <label className="impf">
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => ler(e.target.files?.[0])} disabled={lendo} />
            <Icon name="stack" /><span>{lendo ? "A ler o ficheiro…" : ficheiro || "Escolher ficheiro .xlsx"}</span>
          </label>
          {linhas && (<>
            <div className="isv-k">
              <div><b>{plano.length}</b><span>no Excel</span></div>
              <div className="on"><b>{n("mover")}</b><span>mudam de sítio</span></div>
              <div className="on"><b>{n("criar")}</b><span>novas</span></div>
              <div><b>{n("igual")}</b><span>já estão certas</span></div>
              {n("erro") > 0 && <div className="bad"><b>{n("erro")}</b><span>ignoradas</span></div>}
            </div>
            {saemDoPipeline.length > 0 && <div className="notice warn"><Icon name="warning-circle" /><span>
              {saemDoPipeline.length} {saemDoPipeline.length === 1 ? "sai" : "saem"} do pipeline ({saemDoPipeline.slice(0, 6).map((p) => p.l.nome).join(", ")}{saemDoPipeline.length > 6 ? "…" : ""}).
              Os próximos passos em aberto ficam em espera na ficha da startup e voltam a ficar ativos se ela regressar ao pipeline. A ficha da startup e a análise ficam; a cronologia e os dados da ronda do pipeline são apagados.</span></div>}
            <div className="isv-bar"><b>{tudo ? "Todas as startups" : "O que vai mudar"}</b><span className="sp" />
              <button className="chipf" aria-pressed={tudo} onClick={() => setTudo(!tudo)}>{tudo && <Icon name="check" />}Mostrar também as que já estão certas</button></div>
            {vistos.length ? (
              <div className="tbl isv-t"><table>
                <thead><tr><th>Startup</th><th>Agora</th><th aria-label="Passa para" /><th>Vai para</th></tr></thead>
                <tbody>{vistos.map((p) => (
                  <tr key={p.l.linha} className={`a-${p.acao}`}>
                    <td><b>{p.l.nome}</b><span className="mut sm">Linha {p.l.linha}{p.l.dominio ? ` · ${p.l.dominio}` : ""}</span></td>
                    <td>{p.acao === "erro" ? <span className="mut">-</span> : <Onde o={p.atual} />}</td>
                    <td className="isv-arr">{p.acao === "igual" ? <Icon name="check" /> : p.acao === "erro" ? "" : <Icon name="arrow-right" />}</td>
                    <td>{p.acao === "erro" ? <span className="gerr-in">{p.erro}</span> : <Onde o={p.novo} />}</td>
                  </tr>))}</tbody>
              </table></div>
            ) : <p className="hint">Está tudo no sítio certo.</p>}
          </>)}
        </>)}
        {estado !== "rever" && (<>
          <div className="impp" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={feitas} aria-label="Progresso"><i style={{ width: `${pct}%` }} /></div>
          <p className="hint"><b>{feitas}</b> de {total} startups tratadas{estado === "aplicar" ? "…" : "."}</p>
          {estado === "feito" && n("criar") > 0 && <p className="hint">As startups novas entram sem categoria. Usa «Atribuir categorias» para a Gemini as classificar.</p>}
          {falhas.length > 0 && <p className="gerr" role="alert">Não foram gravadas ({falhas.length}): {falhas.slice(0, 10).join("; ")}{falhas.length > 10 ? "…" : ""}</p>}
        </>)}
        {erro && <p className="gerr" role="alert">{erro}</p>}
      </div>
      <div className="mdl-f">
        <span className="sp" />
        {estado === "rever" && <button className="btn primary" onClick={aplicar} disabled={!linhas || lendo || !total}><Icon name="check" />Aplicar {total || ""} {total === 1 ? "alteração" : "alterações"}</button>}
        {estado === "aplicar" && <button className="btn" onClick={() => { parar.current = true; }}>Parar</button>}
        {estado === "feito" && <button className="btn primary" onClick={() => onDone(`${feitas - falhas.length} startups atualizadas a partir do Excel`)}>Fechar</button>}
      </div>
    </div>
  </>);
}
