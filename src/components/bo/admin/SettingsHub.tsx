"use client";
import { useState } from "react";
import { Area, Category } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { SettingsView } from "./SettingsView";
import { SourcesView } from "./SourcesView";
import { TaxonomyView } from "./TaxonomyView";
import { UsersView } from "./UsersView";
import { RunsView } from "./RunsView";
import { SectorsView } from "./SectorsView";
import { InvestmentView } from "./InvestmentView";

type Sec = "sources" | "taxonomy" | "newsRules" | "sectors" | "startupSources" | "investment" | "startupRules" | "users" | "runs";
const GROUPS: { titulo: string; itens: { id: Sec; label: string; icon: string }[] }[] = [
  { titulo: "Notícias", itens: [
    { id: "sources", label: "Fontes", icon: "rss" },
    { id: "taxonomy", label: "Cadeias de valor e tags", icon: "stack" },
    { id: "newsRules", label: "Regras da recolha", icon: "funnel" },
  ] },
  { titulo: "Startups", itens: [
    { id: "sectors", label: "Categorias e pesquisas", icon: "lightbulb" },
    { id: "startupSources", label: "Fontes", icon: "rss" },
    { id: "investment", label: "Critérios de investimento", icon: "scales" },
    { id: "startupRules", label: "Regras da recolha", icon: "funnel" },
  ] },
  { titulo: "Plataforma", itens: [
    { id: "users", label: "Utilizadores", icon: "users" },
    { id: "runs", label: "Execuções", icon: "chart-line" },
  ] },
];

/** Definições: o que é das notícias, o que é das startups e o que é comum. */
export function SettingsHub({ areas, cats }: { areas: Area[]; cats: Category[] }) {
  const [sec, setSec] = useState<Sec>("sources");
  return (
    <div className="hub">
      <aside className="hubnav" aria-label="Definições">
        <h1>Definições</h1>
        {GROUPS.map((g) => (
          <nav key={g.titulo} aria-label={g.titulo}>
            <h2 className="hubg">{g.titulo}</h2>
            {g.itens.map((x) => (
              <button key={x.id} aria-current={sec === x.id} onClick={() => setSec(x.id)}><Icon name={x.icon} />{x.label}</button>
            ))}
          </nav>
        ))}
      </aside>
      <section className="hubbody">
        {sec === "sources" && <SourcesView key="n" />}
        {sec === "startupSources" && <SourcesView key="s" para="startups" />}
        {sec === "taxonomy" && <TaxonomyView areas={areas} cats={cats} />}
        {sec === "newsRules" && <SettingsView scope="news" />}
        {sec === "sectors" && <SectorsView />}
        {sec === "investment" && <InvestmentView />}
        {sec === "startupRules" && <SettingsView scope="startups" />}
        {sec === "users" && <UsersView />}
        {sec === "runs" && <RunsView />}
      </section>
    </div>
  );
}
