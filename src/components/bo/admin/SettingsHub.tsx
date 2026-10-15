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

type Sec = "geral" | "sources" | "taxonomy" | "sectors" | "users" | "runs";
const SECS: { id: Sec; label: string; icon: string }[] = [
  { id: "geral", label: "Geral", icon: "gear" },
  { id: "sources", label: "Fontes", icon: "rss" },
  { id: "taxonomy", label: "Áreas e categorias", icon: "stack" },
  { id: "sectors", label: "Setores das startups", icon: "lightbulb" },
  { id: "users", label: "Utilizadores", icon: "users" },
  { id: "runs", label: "Execuções", icon: "chart-line" },
];

/** Definições: tudo o que é configuração e administração num só sítio. */
export function SettingsHub({ areas, cats }: { areas: Area[]; cats: Category[] }) {
  const [sec, setSec] = useState<Sec>("geral");
  return (
    <div className="hub">
      <aside className="hubnav" aria-label="Definições">
        <h1>Definições</h1>
        <nav>
          {SECS.map((x) => (
            <button key={x.id} aria-current={sec === x.id} onClick={() => setSec(x.id)}><Icon name={x.icon} />{x.label}</button>
          ))}
        </nav>
      </aside>
      <section className="hubbody">
        {sec === "geral" && <SettingsView />}
        {sec === "sources" && <SourcesView />}
        {sec === "taxonomy" && <TaxonomyView areas={areas} cats={cats} />}
        {sec === "sectors" && <SectorsView />}
        {sec === "users" && <UsersView />}
        {sec === "runs" && <RunsView />}
      </section>
    </div>
  );
}
