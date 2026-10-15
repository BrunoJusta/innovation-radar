const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const fdCurto = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? "" : `${d.getDate()} ${MES_CURTO[d.getMonth()]}`; };
export const fdLongo = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? "" : `${d.getDate()} de ${MES[d.getMonth()]} de ${d.getFullYear()}`; };

/** Trimestre da data, por exemplo "2026-T4". */
export const quarterKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`; };
export const quarterLabel = (key: string) => { const [y, q] = key.split("-"); return `${q} ${y}`; };

export const relLevel = (s: number): "alta" | "media" | "baixa" => (s >= 85 ? "alta" : s >= 65 ? "media" : "baixa");
export const relLabel = (s: number) => ({ alta: "Alta", media: "Média", baixa: "Baixa" })[relLevel(s)];

export const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const nowIso = () => new Date().toISOString();

export function monogram(site: string) {
  const w = site.replace(/^the\s+/i, "").split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || "?") + (w[1]?.[0] || w[0]?.[1] || "")).toUpperCase();
}
