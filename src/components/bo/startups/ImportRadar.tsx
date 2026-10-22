"use client";
import { useMemo, useState } from "react";
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { post } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { abrirZip, lerFolha } from "@/lib/xlsx-lite";
import { CADEIA_DA_VERTICAL, converterRadar, DESTINOS_RADAR, LinhaRadar, origemDe } from "@/lib/import-radar";
import { startupIdDe } from "@/lib/import-dealflow";
import { DEAL_VAZIO, novoPasso, normNome, proximaRef } from "@/lib/deal-actions";
import type { Deal, Startup } from "@/lib/types";
import { nowIso } from "@/lib/util";
import { cadeiasParaApi, useAreas, useCategorias } from "@/lib/use-areas";
import { useSession } from "../AuthGate";

const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const hoje = () => new Date().toISOString().slice(0, 10);

/** Folha a ler: a do ano mais recente (ex.: «2026») ou, se não houver, a primeira. */
async function folhaDoRadar(f: File) {
  const zip = abrirZip(await f.arrayBuffer());
  const nomes = [...(await zip.ler("xl/workbook.xml")).matchAll(/<(?:\w+:)?sheet\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
  const anos = nomes.filter((n) => /^\d{4}$/.test(n.trim())).sort();
  return anos[anos.length - 1] || nomes[0] || "2026";
}

/**
 * Import do Excel «Radar Sogrape Ventures»: cada startup vai para a triagem, as aprovadas ou o pipeline conforme a decisão.
 * As que já existem são atualizadas (não ficam repetidas); a cadeia de valor e a temática em falta são atribuídas pela Gemini.
 */
export function ImportRadar({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const { email } = useSession();
  const areas = useAreas(), categorias = useCategorias();
  const [linhas, setLinhas] = useState<LinhaRadar[] | null>(null);
  const [ficheiro, setFicheiro] = useState("");
  const [erro, setErro] = useState("");
  const [passo, setPasso] = useState<"escolher" | "rever" | "classificar" | "gravar" | "feito">("escolher");
  const [prog, setProg] = useState({ feitas: 0, total: 0 });
  const [res, setRes] = useState<{ novas: number; atualizadas: number; deals: number; semCadeiaGemini: number; semTema: number } | null>(null);
  const porDestino = useMemo(() => DESTINOS_RADAR.map((d) => ({ ...d, n: (linhas || []).filter((l) => l.destino === d.id).length })), [linhas]);

  const ler = async (f: File) => {
    setErro("");
    try {
      const folha = await folhaDoRadar(f);
      const l = converterRadar(await lerFolha(f, folha));
      if (!l.length) throw new Error(`A folha «${folha}» não tem startups (procurei a coluna «Startup Name»).`);
      setLinhas(l); setFicheiro(`${f.name} · folha ${folha}`); setPasso("rever");
    } catch (e) { setErro((e as Error).message || "Não foi possível ler o ficheiro."); }
  };

  const importar = async () => {
    if (!linhas) return;
    setErro("");
    try {
      const [stSnap, dlSnap] = await Promise.all([getDocs(collection(db, "startups")), getDocs(collection(db, "deals"))]);
      const startups = stSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as Startup);
      const deals = dlSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as Deal);
      const idsCad = new Set(areas.map((a) => a.id)), idsCat = new Set(categorias.map((c) => c.id));
      // Ficha que já existe: pelo id (domínio), pelo domínio ou pelo nome
      const existente = (l: LinhaRadar) => {
        const id = startupIdDe(l.nome, l.dominio), n = normNome(l.nome);
        return startups.find((s) => s.id === id) || startups.find((s) => !!l.dominio && s.dominio === l.dominio) || startups.find((s) => !!n && normNome(s.nome) === n);
      };
      const st = new Map(linhas.map((l) => [l.k, existente(l)]));

      // 1) Cadeia de valor e temática em falta: a Gemini classifica pela descrição (com a vertical do Excel como pista)
      setPasso("classificar");
      const semCad = linhas.filter((l) => !idsCad.has(st.get(l.k)?.cadeia || "")), semCat = linhas.filter((l) => !idsCat.has(st.get(l.k)?.setor || ""));
      setProg({ feitas: 0, total: semCad.length + semCat.length });
      const cad: Record<string, string> = {}, cat: Record<string, string> = {};
      let feitas = 0;
      for (let i = 0; i < semCad.length; i += 60) {
        const lote = semCad.slice(i, i + 60);
        try {
          const j = await post<{ cadeias: Record<string, string> }>("/api/startups/cadeias", { startups: lote.map((l) => ({ id: String(l.k), nome: l.nome, descricao: l.descricao || l.nome, setor: l.verticalExcel })), cadeias: cadeiasParaApi(areas) });
          Object.assign(cad, j.cadeias);
        } catch { /* fica a cadeia da vertical */ }
        feitas += lote.length; setProg({ feitas, total: semCad.length + semCat.length });
      }
      for (let i = 0; i < semCat.length; i += 80) {
        const lote = semCat.slice(i, i + 80);
        try {
          const j = await post<{ setores: Record<string, string> }>("/api/startups/setores", { startups: lote.map((l) => ({ id: String(l.k), nome: l.nome, descricao: l.descricao || l.nome })), sectors: cadeiasParaApi(categorias) });
          Object.assign(cat, j.setores);
        } catch { /* a recolha semanal classifica depois as que ficarem sem temática */ }
        feitas += lote.length; setProg({ feitas, total: semCad.length + semCat.length });
      }
      const cadeiaPorDefeito = (l: LinhaRadar) => { const c = CADEIA_DA_VERTICAL[l.vertical] || "adjacencias"; return idsCad.has(c) ? c : areas.find((a) => a.id === "adjacencias")?.id || areas[areas.length - 1]?.id || c; };

      // 2) Gravar: fichas das startups e, para o pipeline, os deals
      setPasso("gravar"); setProg({ feitas: 0, total: linhas.length });
      const agora = nowIso(), r = { novas: 0, atualizadas: 0, deals: 0, semCadeiaGemini: semCad.filter((l) => !cad[String(l.k)]).length, semTema: semCat.filter((l) => !cat[String(l.k)]).length };
      const refs = [...deals];
      for (let i = 0; i < linhas.length; i += 40) {
        const b = writeBatch(db);
        for (const l of linhas.slice(i, i + 40)) {
          const e = st.get(l.k), sid = e?.id || startupIdDe(l.nome, l.dominio);
          const cadeia = idsCad.has(e?.cadeia || "") ? e!.cadeia! : cad[String(l.k)] || cadeiaPorDefeito(l);
          const setor = idsCat.has(e?.setor || "") ? e!.setor : cat[String(l.k)] || "";
          const quando = l.data ? `${l.data}T12:00:00.000Z` : agora;
          const origem = { tipo: "manual" as const, titulo: `Radar Sogrape Ventures 2026 · ${l.fonte || "sem fonte"}`, url: l.site, data: quando };
          const naPipeline = l.destino === "pipeline" || l.destino === "arquivo-pipeline";
          const status = l.destino === "rejeitada" ? "rejected" : l.destino === "triagem" ? "pending" : "approved";
          const fin = [l.financiamento && `${l.financiamento} levantados`, l.quanto && `procura: ${l.quanto}`].filter(Boolean).join("; ");
          // Deal no pipeline (só se ainda não houver um para esta startup)
          let dealId = e?.dealId || deals.find((d) => d.startupId === sid || (!!l.dominio && d.dominio === l.dominio) || normNome(d.nome) === normNome(l.nome))?.id;
          if (naPipeline && !dealId) {
            const ref = proximaRef(refs), id = `rd-${ref}`;
            const arq = l.destino === "arquivo-pipeline";
            const texto = l.proximos || "Rever o ponto de situação";
            const deal: Omit<Deal, "id"> = {
              ...DEAL_VAZIO(), ref, nome: l.nome, site: l.site, dominio: l.dominio, descricao: l.descricao, pais: l.pais, vertical: l.vertical, fase: l.faseDeal,
              cadeia, ...(setor ? { categoria: setor } : {}), etapa: arq ? "arquivada" : "fit", etapaDesde: l.dataDecisao || hoje(), entrada: l.data || hoje(),
              vez: arq ? null : "sogrape", proximaAcao: arq ? "" : texto, passos: arq ? [] : [novoPasso({ texto })],
              ronda: { valuation: null, valor: null, ticket: null, lead: "", coinvestidores: [], notas: fin },
              origem: { ...origemDe(l.fonte), contacto: "" },
              arquivo: arq ? { motivo: "outro", nota: l.feedback || "Arquivada no Radar Sogrape Ventures 2026", em: l.dataDecisao || hoje(), etapaAnterior: "fit" } : null,
              startupId: sid, importado: true, criadoEm: agora, atualizadoEm: agora, criadoPor: email,
            };
            b.set(doc(db, "deals", id), clean(deal));
            b.set(doc(db, "deals", id, "interacoes", "rd-0"), clean({ data: l.data || hoje(), tipo: "etapa", texto: `Importada do Radar Sogrape Ventures 2026 (${l.decisao || "sem decisão"}).`, por: "Excel", criadoEm: agora }));
            if (l.feedback) b.set(doc(db, "deals", id, "interacoes", "rd-1"), clean({ data: l.dataDecisao || l.data || hoje(), tipo: "nota", texto: l.feedback, por: "Excel", criadoEm: agora }));
            refs.push({ ...deal, id } as Deal); dealId = id; r.deals++;
          }
          if (e) {
            // Já existe: fica com a decisão do Excel (menos as que já estão no pipeline, que mantêm o estado), e com a cadeia e a temática em falta
            const upd: Record<string, unknown> = { atualizadoEm: agora, cadeia, ...(setor ? { setor } : {}), origens: [...(e.origens || []).filter((o) => !o.titulo.startsWith("Radar Sogrape Ventures 2026")), origem] };
            if (!e.dealId || naPipeline) Object.assign(upd, { status, ...(status === "rejected" ? { motivoRejeicao: "NO GO no Radar Sogrape Ventures 2026" } : {}), ...(status === "approved" && e.status !== "approved" ? { aprovadoEm: agora, aprovadoPor: email } : {}) });
            if (l.feedback && !e.porque) upd.porque = l.feedback;
            if (dealId && naPipeline) Object.assign(upd, { dealId, pipelineEm: e.pipelineEm || agora });
            b.update(doc(db, "startups", e.id), clean(upd));
            r.atualizadas++;
          } else {
            const nova: Omit<Startup, "id"> = {
              status, nome: l.nome, site: l.site, dominio: l.dominio, pais: l.pais, fundacao: null, fase: l.faseStartup, setor, cadeia,
              descricao: l.descricao, porque: l.feedback, relevancia: 50, financiamento: fin, investidores: [], origens: [origem], destaque: false,
              criadoEm: quando, atualizadoEm: agora, manual: true, criadoPor: email,
              ...(status === "rejected" ? { motivoRejeicao: "NO GO no Radar Sogrape Ventures 2026" } : {}),
              ...(status === "approved" ? { aprovadoEm: agora, aprovadoPor: email } : {}),
              ...(dealId ? { dealId, pipelineEm: agora } : {}),
            };
            b.set(doc(db, "startups", sid), clean(nova));
            startups.push({ ...nova, id: sid } as Startup);
            r.novas++;
          }
        }
        await b.commit();
        setProg({ feitas: Math.min(i + 40, linhas.length), total: linhas.length });
      }
      setRes(r); setPasso("feito");
      onDone(`Radar importado: ${r.novas} novas, ${r.atualizadas} atualizadas, ${r.deals} no pipeline`);
    } catch (e) {
      setErro(`O import parou: ${(e as Error).message || "erro desconhecido"}. O que já foi gravado fica; podes correr outra vez, as startups não ficam repetidas.`);
      setPasso("rever");
    }
  };

  const ocupado = passo === "classificar" || passo === "gravar";
  return (<>
    <div className="scrim" onClick={() => !ocupado && onClose()} />
    <div className="mdl wide" role="dialog" aria-modal="true" aria-labelledby="ir-t">
      <div className="mdl-h"><h2 id="ir-t">Importar o Radar Sogrape Ventures</h2><button className="btn icon" aria-label="Fechar" onClick={onClose} disabled={ocupado}><Icon name="x" /></button></div>
      <div className="mdl-b scroll">
        {passo === "escolher" && <>
          <p className="hint">Escolhe o Excel do Radar (a folha do ano, por exemplo «2026»). Cada startup vai para onde diz a «Stepwise Decision». As que já existirem são atualizadas, não repetidas.</p>
          <label className="btn primary ir-file"><Icon name="upload-simple" />Escolher o Excel<input type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) ler(f); }} /></label>
        </>}
        {linhas && passo !== "escolher" && <>
          <p className="ir-f"><Icon name="check-circle" />{ficheiro}: {linhas.length} startups</p>
          <ul className="ir-dest">{porDestino.map((d) => (
            <li key={d.id}><b>{d.n}</b><span>{d.nome}</span><em>{d.decisao}</em></li>))}</ul>
          <p className="hint">As que não tiverem cadeia de valor ou temática ficam com as que a Gemini atribuir pela descrição (a vertical do Excel serve de pista). As do pipeline entram em Validation Fit, com o feedback do Excel no histórico.</p>
        </>}
        {ocupado && <p className="ir-prog" role="status"><span className="spin" aria-hidden="true" />{passo === "classificar" ? "A atribuir cadeias de valor e temáticas com a Gemini" : "A gravar"}: {prog.feitas} de {prog.total}</p>}
        {passo === "feito" && res && (
          <div className="notice ok" role="status"><Icon name="check-circle" /><span>{res.novas} startups novas, {res.atualizadas} atualizadas e {res.deals} fichas criadas no pipeline.
            {res.semCadeiaGemini > 0 && ` ${res.semCadeiaGemini} ficaram com a cadeia de valor da vertical do Excel.`}
            {res.semTema > 0 && ` ${res.semTema} ficaram sem temática; a recolha semanal atribui-a.`}</span></div>)}
        {erro && <div className="notice warn" role="alert"><span>{erro}</span></div>}
      </div>
      <div className="mdl-f"><span className="sp" />
        {passo === "feito" ? <button className="btn primary" onClick={onClose}><Icon name="check" />Fechar</button> : <>
          <button className="txtbtn" onClick={onClose} disabled={ocupado}>Cancelar</button>
          {linhas && <button className="btn primary" onClick={importar} disabled={ocupado}>{ocupado ? <><span className="spin" aria-hidden="true" />A importar…</> : <><Icon name="upload-simple" />Importar {linhas.length} startups</>}</button>}
        </>}
      </div>
    </div>
  </>);
}
