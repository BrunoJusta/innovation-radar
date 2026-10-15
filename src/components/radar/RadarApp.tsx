"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { loadPublished, loadStructure } from "@/lib/data";
import { Area, Category, Settings, Signal } from "@/lib/types";
import { quarterKey, quarterLabel } from "@/lib/util";
import { SignalModal } from "./SignalModal";
import { ChartItem, layout, RadarChart, ringRadii } from "./RadarChart";

export interface RadarItem extends ChartItem {
  area: string; cat: string;
  resumo: string; entidades: string[]; fontes: { titulo: string; url: string }[];
  data: string; relevancia: number; destaque: boolean;
}

export default function RadarApp() {
  // Dentro do backoffice (separador Radar das notícias) o radar abre sem o cabeçalho do site
  const [embed, setEmbed] = useState(false);
  useEffect(() => { setEmbed(new URLSearchParams(window.location.search).has("embed")); }, []);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [fRing, setFRing] = useState<string | null>(null);
  const [fCat, setFCat] = useState<string>("all");
  const [period, setPeriod] = useState<string>("recent");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadStructure(), loadPublished()])
      .then(([st, pub]) => { setAreas(st.areas); setCats(st.categories); setSettings(st.settings); setSignals(pub); setState("ok"); })
      .catch((e) => { console.error(e); setState("error"); });
  }, []);

  const quarters = useMemo(() => {
    const set = new Set(signals.map((s) => quarterKey(s.publicado!.dataPublicacao)));
    return [...set].sort().reverse();
  }, [signals]);

  const area = (id: string) => areas.find((a) => a.id === id);
  const cat = (id: string) => cats.find((c) => c.id === id);

  // Notícias do período escolhido, com posição no radar
  const R = useMemo(() => ringRadii(areas.length), [areas.length]);
  const items: RadarItem[] = useMemo(() => {
    if (!settings) return [];
    const limit = Date.now() - settings.janelaDias * 864e5;
    const inPeriod = signals.filter((s) => {
      const d = s.publicado!.dataPublicacao;
      return period === "recent" ? new Date(d).getTime() >= limit : quarterKey(d) === period;
    });
    const base = inPeriod.map((s) => {
      const p = s.publicado!;
      const a = areas.find((x) => x.id === p.area), c = cats.find((x) => x.id === p.categoria);
      return { id: s.id, ring: p.area, area: p.area, cat: p.categoria, group: p.categoria, color: a?.cor || "#999",
        titulo: p.titulo, sub: `${a?.nome || ""}, ${c?.nome || ""}`, resumo: p.resumo, entidades: p.entidades || [], fontes: p.fontes || [],
        data: p.dataPublicacao, relevancia: p.relevancia, destaque: p.destaque };
    });
    return layout(areas, base);
  }, [signals, areas, cats, settings, period]);

  const counts = (aid: string) => items.filter((x) => x.area === aid && (fCat === "all" || x.cat === fCat)).length;
  const open = items.find((x) => x.id === openId) || null;

  return (
    <div className={`rp${embed ? " embed" : ""}`}>
      {!embed && <header className="top"><div className="wrap topin"><a className="brand" href="/">Radar de Inovação</a></div></header>}
      <main>
        <section className="wrap hero" aria-label="Radar">
          <div className="htxt">
            <h1>O que está a mudar no vinho</h1>
            <p className="sub">Sinais escolhidos pela equipa de Inovação, organizados por área para cada equipa encontrar o que lhe interessa.</p>
          </div>
          <div className="hleg">
            <div className={`legend${fRing ? " filtering" : ""}`} role="group" aria-label="Filtrar por área">
              {areas.map((a) => (
                <button key={a.id} className="lg" style={{ ["--c" as string]: a.cor }} aria-pressed={fRing === a.id} onClick={() => setFRing(fRing === a.id ? null : a.id)}>
                  <span className="sw" /><b>{a.nome}</b><span className="n">{counts(a.id)}</span><span className="d">{a.descricao}</span>
                </button>
              ))}
            </div>
            <div className="cats" role="group" aria-label="Filtrar por categoria">
              <button className="chip" aria-pressed={fCat === "all"} onClick={() => setFCat("all")}>Todas as categorias</button>
              {cats.map((c) => (
                <button key={c.id} className="chip" aria-pressed={fCat === c.id} onClick={() => setFCat(c.id)}><Icon name={c.icone} />{c.nome}</button>
              ))}
            </div>
            <label className="periodo">
              <span>Período</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período">
                <option value="recent">Últimos {settings?.janelaDias ?? 90} dias</option>
                {quarters.map((q) => <option key={q} value={q}>{quarterLabel(q)}</option>)}
              </select>
            </label>
          </div>
          <RadarChart rings={areas} items={items} fRing={fRing} fGroup={fCat} regrowKey={period} onOpen={setOpenId} state={state}
            emptyTitle="Ainda sem sinais neste período" emptyText="Assim que a equipa de Inovação aprovar notícias, elas aparecem aqui." ariaLabel="Radar com os sinais do período" />
        </section>
      </main>
      {open && (
        <SignalModal item={open} items={items} areas={areas} R={R} area={area(open.area)} cat={cat(open.cat)} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
