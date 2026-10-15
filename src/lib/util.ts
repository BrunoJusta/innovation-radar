const F_MES_CURTO = new Intl.DateTimeFormat("pt-PT", { month: "short" });
const F_LONGO = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" });
/** Datas só com dia (AAAA-MM-DD) são lidas como dia local, e não como meia-noite UTC. */
const toDate = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
export const fdCurto = (iso: string) => { const d = toDate(iso); return isNaN(+d) ? "" : `${d.getDate()} ${F_MES_CURTO.format(d).replace(".", "")}`; };
export const fdLongo = (iso: string) => { const d = toDate(iso); return isNaN(+d) ? "" : F_LONGO.format(d); };
/** Data de hoje no fuso de quem usa (AAAA-MM-DD). */
export const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/** "1 dia", "3 dias". */
export const nDias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

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
