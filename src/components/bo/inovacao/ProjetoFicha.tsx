"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Area, Startup } from "@/lib/types";
import { ESTADOS_PROJ, FASES_PROJ, HORIZONTES, MWB, PAPEIS_EQUIPA, Projeto, RELACOES, corDe, dataPt, eur } from "@/lib/inovacao";
import { Logo } from "../startups/Logo";
import { Eur, Parceiro, Sel, SimNao, StartupPicker } from "./shared";

const iniciais = (n: string) => n.trim().split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "?";

/** Ficha de leitura do projeto, no formato do one-pager de Inovação: à esquerda a história, à direita os dados. */
export function ProjetoFicha({ p, cadeia, startup }: { p: Projeto; cadeia: string; startup?: Startup }) {
  const equipa = (p.equipa || []).filter((x) => x.nome.trim());
  const kpis = (p.kpis || []).filter(Boolean), cond = (p.condicoes || []).filter(Boolean);
  const proposta = p.proposta || p.descricao;
  const falta = [!p.desafio && "o desafio", !p.casoUso && "o caso de uso", !equipa.length && "a equipa", p.piloto && !kpis.length && "os KPIs do piloto"].filter(Boolean) as string[];
  const est = ESTADOS_PROJ.find((e) => e.id === p.estado);
  const tiles: { l: string; i: string; v: React.ReactNode; c?: string }[] = [
    { l: "Must Win Battle", i: "target", v: p.mwb || "Por definir", c: p.mwb ? corDe(p.mwb) : undefined },
    { l: "Cadeia de valor", i: "wine", v: cadeia || "Por definir" },
    { l: "Stage", i: "kanban", v: p.fase || "Por definir" },
    { l: "Tipo", i: "users", v: p.relacao || "Por definir" },
    { l: "Parceiro", i: "briefcase", v: p.parceiro ? <span className="pf-par">{startup && <Logo nome={startup.nome} logo={startup.logo} />}<span title={p.parceiro}>{p.parceiro}</span></span> : "Sem parceiro" },
    { l: "Estado", i: p.estado === "Finished" ? "check-circle" : "clock", v: p.estado, c: est?.cor },
  ];
  return (
    <div className="pf" lang="pt-PT">
      <div className="pf-main">
        {p.desafio && <section><h3>Desafio</h3><p className="pf-hmw">{p.desafio}</p></section>}
        {proposta && <section><h3>Proposta de valor</h3><p>{proposta}</p></section>}
        {p.casoUso && <section><h3>Caso de uso Sogrape</h3><p>{p.casoUso}</p></section>}
        {p.imagem && <img className="pf-img" src={p.imagem} alt={`Imagem do projeto ${p.nome}`} width={640} height={360} loading="lazy" />}
        {equipa.length > 0 && (
          <section><h3>Equipa</h3>
            <ul className="pf-team">{equipa.map((m, i) => (
              <li key={i}><span className="pf-av" aria-hidden="true">{iniciais(m.nome)}</span><b>{m.nome}</b>{m.papel && <em>{m.papel}</em>}</li>))}</ul>
          </section>)}
        {p.observacoes && <section><h3>Observações</h3><p>{p.observacoes}</p></section>}
        {falta.length > 0 && <p className="pf-falta"><Icon name="pencil-simple" />Falta {falta.join(", ").replace(/, ([^,]*)$/, " e $1")}. Carrega em Editar para completar a ficha.</p>}
      </div>
      <aside className="pf-side" aria-label="Dados do projeto">
        <dl className="pf-tiles">{tiles.map((t) => (
          <div key={t.l} style={t.c ? { ["--c" as string]: t.c } : undefined} className={t.c ? "on" : ""}>
            <dt>{t.l}</dt><dd><Icon name={t.i} />{t.v}</dd>
          </div>))}</dl>
        {p.piloto && (kpis.length > 0 || cond.length > 0 || p.pilotoDesde) && (
          <div className="pf-pil">
            {kpis.length > 0 && <section><h3>KPIs do piloto</h3><ul>{kpis.map((k, i) => <li key={i}>{k}</li>)}</ul></section>}
            {cond.length > 0 && <section><h3>Condições do piloto</h3><ul>{cond.map((k, i) => <li key={i}>{k}</li>)}</ul></section>}
            {p.pilotoDesde && <p className="pf-pd">Piloto em discussão desde {dataPt(p.pilotoDesde)}</p>}
          </div>)}
        <dl className="pf-num">
          <div><dt>Período</dt><dd>{p.inicio ? `${dataPt(p.inicio)} a ${p.fim ? dataPt(p.fim) : "hoje"}` : "Por definir"}</dd></div>
          <div><dt>Horizonte</dt><dd>{p.horizonte ? p.horizonte.replace(" Innovation", "") : "Por definir"}</dd></div>
          <div><dt>Orçamento estimado</dt><dd>{eur(p.orcamento) || "Sem dados"}</dd></div>
          <div className="big"><dt>Total gasto até agora</dt><dd>{eur(p.gasto ?? 0)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

/** Lista de linhas (KPIs, condições): uma por linha, sem perder o que se está a escrever. */
function Linhas({ label, v, on, ph }: { label: string; v: string[]; on: (l: string[]) => void; ph: string }) {
  const [t, setT] = useState(v.join("\n"));
  return <label className="fld full"><span>{label}</span><textarea rows={Math.min(7, Math.max(3, v.length + 1))} value={t} placeholder={ph}
    onChange={(e) => { setT(e.target.value); on(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean)); }} /><small className="fhint">Um por linha.</small></label>;
}

/** Reduz a imagem no browser (máx. 960 px, JPEG) para caber no documento. */
async function reduzir(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, 960 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally { URL.revokeObjectURL(url); }
}

/** Formulário do projeto, por secções. */
export function ProjetoForm({ ed, setEd, areas, startups, parceiros }: {
  ed: Projeto; setEd: (p: Projeto) => void; areas: Area[]; startups: Startup[]; parceiros: { ref: string; nome: string }[];
}) {
  const set = (x: Partial<Projeto>) => setEd({ ...ed, ...x });
  const equipa = ed.equipa || [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgErro, setImgErro] = useState("");
  return (
    <div className="pfo">
      <section><h4>Identificação</h4>
        <div className="fgrid">
          <label className="fld wide"><span>Nome</span><input autoComplete="off" value={ed.nome} onChange={(e) => set({ nome: e.target.value })} /></label>
          <Sel label="Estado" value={ed.estado} opcoes={ESTADOS_PROJ.map((e) => e.id)} onChange={(v) => set({ estado: v })} />
          <Sel label="Stage" value={ed.fase || ""} opcoes={FASES_PROJ} onChange={(v) => set({ fase: v })} />
          <Sel label="Must Win Battle" value={ed.mwb} opcoes={MWB} onChange={(v) => set({ mwb: v })} />
          <Sel label="Cadeia de valor" value={ed.cadeia} opcoes={areas.map((a) => ({ id: a.id, nome: a.nome }))} onChange={(v) => set({ cadeia: v })} />
          <Sel label="Horizonte de inovação" value={ed.horizonte} opcoes={HORIZONTES} onChange={(v) => set({ horizonte: v })} />
          <SimNao label="Tem piloto" value={ed.piloto} onChange={(v) => set({ piloto: v })} />
        </div>
      </section>
      <section><h4>A história</h4>
        <div className="fgrid">
          <label className="fld full"><span>Desafio</span><textarea rows={2} value={ed.desafio || ""} placeholder="How might we…" onChange={(e) => set({ desafio: e.target.value })} /></label>
          <label className="fld full"><span>Proposta de valor</span><textarea rows={3} value={ed.proposta || ""} placeholder="O que a solução faz e porque é diferente…" onChange={(e) => set({ proposta: e.target.value })} /></label>
          <label className="fld full"><span>Caso de uso Sogrape</span><textarea rows={3} value={ed.casoUso || ""} placeholder="O que vamos testar na Sogrape e como medimos…" onChange={(e) => set({ casoUso: e.target.value })} /></label>
          <label className="fld full"><span>Resumo para a lista</span><textarea rows={2} value={ed.descricao} onChange={(e) => set({ descricao: e.target.value })} /><small className="fhint">Aparece na tabela dos projetos. Se não houver proposta de valor, é ela que aparece na ficha.</small></label>
        </div>
      </section>
      <section><h4>Parceiro</h4>
        <div className="fgrid">
          <Sel label="Tipo de parceiro" value={ed.relacao} opcoes={RELACOES} onChange={(v) => set({ relacao: v, ...(v !== "Startup" ? { startupId: "" } : {}) })} />
          {ed.relacao === "Startup"
            ? <StartupPicker startups={startups} startupId={ed.startupId} nome={ed.parceiro}
                onPick={(st, nome) => set({ startupId: st?.id || "", parceiro: nome, parceiroRef: parceiros.find((x) => x.nome.toLowerCase() === nome.trim().toLowerCase())?.ref || "" })} />
            : <Parceiro nome={ed.parceiro} parceiros={parceiros} onChange={(nome, ref) => set({ parceiro: nome, parceiroRef: ref, startupId: "" })} />}
          <label className="fld"><span>Ref. do parceiro</span><input value={ed.parceiroRef || (ed.parceiro.trim() ? "Nova, ao guardar" : "")} readOnly tabIndex={-1} /></label>
        </div>
      </section>
      <section><h4>Equipa</h4>
        {equipa.length > 0 && <div className="pfo-eq">{equipa.map((m, i) => (
          <div key={i} className="pfo-eqr">
            <label className="fld"><span className="vh">Nome {i + 1}</span><input autoComplete="name" value={m.nome} placeholder="Nome…" onChange={(e) => set({ equipa: equipa.map((x, k) => k === i ? { ...x, nome: e.target.value } : x) })} /></label>
            <Sel label={`Papel de ${m.nome || `pessoa ${i + 1}`}`} cls="fld vhl" value={m.papel} opcoes={PAPEIS_EQUIPA} vazio="Papel" onChange={(v) => set({ equipa: equipa.map((x, k) => k === i ? { ...x, papel: v } : x) })} />
            <button type="button" className="btn icon" aria-label={`Tirar ${m.nome || "pessoa"} da equipa`} onClick={() => set({ equipa: equipa.filter((_, k) => k !== i) })}><Icon name="trash" /></button>
          </div>))}</div>}
        <button type="button" className="txtbtn" onClick={() => set({ equipa: [...equipa, { nome: "", papel: "" }] })}><Icon name="plus" />Juntar pessoa</button>
      </section>
      {ed.piloto && <section><h4>Piloto</h4>
        <div className="fgrid">
          <label className="fld"><span>Em discussão desde</span><input type="date" value={ed.pilotoDesde} onChange={(e) => set({ pilotoDesde: e.target.value })} /></label>
          <Linhas label="KPIs do piloto" v={ed.kpis || []} on={(l) => set({ kpis: l })} ph="Validar a metodologia com dados internos…" />
          <Linhas label="Condições do piloto" v={ed.condicoes || []} on={(l) => set({ condicoes: l })} ph="Período de execução: 6 meses…" />
        </div>
      </section>}
      <section><h4>Datas e orçamento</h4>
        <div className="fgrid">
          <label className="fld"><span>Início</span><input type="date" value={ed.inicio} onChange={(e) => set({ inicio: e.target.value })} /></label>
          <label className="fld"><span>Fim</span><input type="date" value={ed.fim} min={ed.inicio || undefined} onChange={(e) => set({ fim: e.target.value })} /></label>
          <Eur label="Orçamento estimado (€)" v={ed.orcamento} on={(n) => set({ orcamento: n })} />
          <Eur label="Gasto até agora (€)" v={ed.gasto} on={(n) => set({ gasto: n })} />
        </div>
      </section>
      <section><h4>Imagem</h4>
        <div className="pfo-img">
          {ed.imagem ? <img src={ed.imagem} alt="Imagem atual do projeto" width={160} height={90} /> : <span className="pfo-noimg"><Icon name="upload-simple" /></span>}
          <div>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload-simple" />{ed.imagem ? "Trocar imagem" : "Carregar imagem"}</button>
            {ed.imagem && <button type="button" className="txtbtn" onClick={() => set({ imagem: "" })}>Tirar</button>}
            <small className="fhint">Por exemplo, os produtos do caso de uso. É reduzida para 960 px.</small>
            {imgErro && <em className="ferr" role="alert">{imgErro}</em>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
            try { setImgErro(""); set({ imagem: await reduzir(f) }); } catch { setImgErro("Não foi possível ler a imagem. Experimenta um JPG ou PNG."); }
          }} />
        </div>
      </section>
      <section><h4>Observações</h4>
        <label className="fld full"><span className="vh">Observações</span><textarea rows={2} value={ed.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></label>
      </section>
    </div>
  );
}
