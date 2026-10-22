"use client";
import { Icon } from "@/components/Icon";
import { AMBITOS, Evento, OBJETIVOS_EV, PAPEIS, TIPOS_EV, corDe, dataPt, eur } from "@/lib/inovacao";
import { Eur, Parceiro, Sel, SimNao } from "./shared";

const F_DIA = new Intl.DateTimeFormat("pt-PT", { day: "numeric" });
const F_MES = new Intl.DateTimeFormat("pt-PT", { month: "short" });
const F_ANO = new Intl.DateTimeFormat("pt-PT", { year: "numeric" });
const F_SEM = new Intl.DateTimeFormat("pt-PT", { weekday: "long" });
const d = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
/** Domínio de um link, para mostrar quando não há título. */
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const dias = (a: string, b: string) => Math.round((+d(b) - +d(a)) / 864e5) + 1;

/** Ficha de leitura do evento: a data em destaque, o papel da Sogrape e os custos ao lado. */
export function EventoFicha({ e }: { e: Evento }) {
  const varios = !!e.fim && e.fim !== e.inicio;
  const tiles: { l: string; i: string; v: string }[] = [
    { l: "Tipo", i: "calendar-blank", v: e.tipo }, { l: "Objetivo", i: "target", v: e.objetivo }, { l: "Papel da Sogrape", i: "users", v: e.papel },
    { l: "Âmbito", i: "globe", v: e.ambito }, { l: "País", i: "globe", v: e.pais },
  ].filter((t) => t.v);
  return (
    <div className="pf ef">
      <div className="pf-main">
        {e.inicio && (
          <div className="ef-data">
            <time dateTime={e.inicio} className="ef-cal"><b>{F_DIA.format(d(e.inicio))}</b><span>{F_MES.format(d(e.inicio)).replace(".", "")}</span><em>{F_ANO.format(d(e.inicio))}</em></time>
            <div><p className="ef-dl">{varios ? `${dataPt(e.inicio)} a ${dataPt(e.fim)}` : F_SEM.format(d(e.inicio))}</p>
              <p className="mut">{varios ? `${dias(e.inicio, e.fim)} dias` : "Um dia"}{e.pais ? `, ${e.pais}` : ""}</p></div>
          </div>)}
        <section><h3>Parceiro</h3>
          <p>{e.parceiro ? <>{e.parceiro}</> : e.parceria ? "Com parceria, sem parceiro indicado" : "Sem parceria"}</p></section>
        {(e.links || []).length > 0 && (
          <section><h3>Links</h3>
            <ul className="ef-links">{(e.links || []).map((l, i) => (
              <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer"><Icon name="arrow-up-right" /><span><b>{l.titulo || host(l.url)}</b>{l.titulo && <small>{host(l.url)}</small>}</span></a></li>))}</ul>
          </section>)}
        {e.observacoes && <section><h3>Observações</h3><p>{e.observacoes}</p></section>}
      </div>
      <aside className="pf-side" aria-label="Dados do evento">
        <dl className="pf-tiles">{tiles.map((t) => (
          <div key={t.l} className={["Tipo", "Objetivo", "Papel da Sogrape"].includes(t.l) ? "on" : ""} style={["Tipo", "Objetivo", "Papel da Sogrape"].includes(t.l) ? { ["--c" as string]: corDe(t.v) } : undefined}>
            <dt>{t.l}</dt><dd><Icon name={t.i} />{t.v}</dd></div>))}</dl>
        <dl className="pf-num">
          <div><dt>Patrocínio</dt><dd>{e.patrocinio ? (eur(e.valorPatrocinio) || "Sim, sem valor") : "Não"}</dd></div>
          <div className="big"><dt>Gasto</dt><dd>{eur(e.gasto ?? 0)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

/** Formulário do evento, por secções. */
export function EventoForm({ ed, setEd, parceiros }: { ed: Evento; setEd: (e: Evento) => void; parceiros: { ref: string; nome: string }[] }) {
  const set = (x: Partial<Evento>) => setEd({ ...ed, ...x });
  return (
    <div className="pfo">
      <section><h4>Evento</h4>
        <div className="fgrid">
          <label className="fld full"><span>Nome</span><input autoComplete="off" value={ed.nome} onChange={(e) => set({ nome: e.target.value })} /></label>
          <Sel label="Tipo" value={ed.tipo} opcoes={TIPOS_EV} onChange={(v) => set({ tipo: v })} />
          <Sel label="Objetivo" value={ed.objetivo} opcoes={OBJETIVOS_EV} onChange={(v) => set({ objetivo: v })} />
          <Sel label="Papel da Sogrape" value={ed.papel} opcoes={PAPEIS} onChange={(v) => set({ papel: v })} />
          <Sel label="Âmbito" value={ed.ambito} opcoes={AMBITOS} onChange={(v) => set({ ambito: v })} />
        </div>
      </section>
      <section><h4>Data e local</h4>
        <div className="fgrid">
          <label className="fld"><span>Início</span><input type="date" value={ed.inicio} onChange={(e) => set({ inicio: e.target.value, fim: !ed.fim || ed.fim < e.target.value ? e.target.value : ed.fim })} /></label>
          <label className="fld"><span>Fim</span><input type="date" value={ed.fim} min={ed.inicio || undefined} onChange={(e) => set({ fim: e.target.value })} /></label>
          <label className="fld wide"><span>País</span><input autoComplete="country-name" value={ed.pais} onChange={(e) => set({ pais: e.target.value })} /></label>
        </div>
      </section>
      <section><h4>Parceria</h4>
        <div className="fgrid">
          <SimNao label="Com parceria" value={ed.parceria} onChange={(v) => set({ parceria: v })} />
          <Parceiro nome={ed.parceiro} parceiros={parceiros} onChange={(nome, ref) => set({ parceiro: nome, parceiroRef: ref, parceria: ed.parceria || !!nome.trim() })} />
        </div>
      </section>
      <section><h4>Custos</h4>
        <div className="fgrid">
          <SimNao label="Patrocínio" value={ed.patrocinio} onChange={(v) => set({ patrocinio: v })} />
          <Eur label="Valor do patrocínio (€)" v={ed.valorPatrocinio} on={(n) => set({ valorPatrocinio: n, patrocinio: ed.patrocinio || (n ?? 0) > 0 })} />
          <Eur label="Gasto (€)" v={ed.gasto} on={(n) => set({ gasto: n })} />
        </div>
      </section>
      <section><h4>Links</h4>
        {(ed.links || []).length > 0 && <div className="ef-led">{(ed.links || []).map((l, i) => (
          <div key={i} className="ef-ler">
            <label className="fld"><span className="vh">Título do link {i + 1}</span><input value={l.titulo} placeholder="Título (opcional)…" autoComplete="off"
              onChange={(e) => set({ links: (ed.links || []).map((x, k) => k === i ? { ...x, titulo: e.target.value } : x) })} /></label>
            <label className="fld"><span className="vh">Endereço do link {i + 1}</span><input type="url" inputMode="url" value={l.url} placeholder="https://…" autoComplete="off" spellCheck={false}
              onChange={(e) => set({ links: (ed.links || []).map((x, k) => k === i ? { ...x, url: e.target.value } : x) })} /></label>
            <button type="button" className="btn icon" aria-label={`Tirar o link ${l.titulo || i + 1}`} onClick={() => set({ links: (ed.links || []).filter((_, k) => k !== i) })}><Icon name="trash" /></button>
          </div>))}</div>}
        <button type="button" className="txtbtn" onClick={() => set({ links: [...(ed.links || []), { titulo: "", url: "" }] })}><Icon name="plus" />Juntar link</button>
      </section>
      <section><h4>Observações</h4>
        <label className="fld full"><span className="vh">Observações</span><textarea rows={2} value={ed.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></label>
      </section>
    </div>
  );
}
