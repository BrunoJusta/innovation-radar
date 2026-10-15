import { createHash } from "node:crypto";

const DROP = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$|cmpid$|_ga$|igshid$|amp$)/i;

/** Normaliza um URL para que o mesmo artigo dê sempre o mesmo hash. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.protocol = "https:";
    if ((u.port === "443") || (u.port === "80")) u.port = "";
    const keep = [...u.searchParams.entries()].filter(([k]) => !DROP.test(k)).sort(([a], [b]) => a.localeCompare(b));
    u.search = keep.length ? "?" + new URLSearchParams(keep).toString() : "";
    let p = u.pathname.replace(/\/{2,}/g, "/");
    if (p.length > 1) p = p.replace(/\/+$/, "");
    p = p.replace(/\/amp$/i, "");
    return `${u.protocol}//${u.host}${p === "/" ? "" : p}${u.search}`;
  } catch { return raw.trim(); }
}

export const urlHash = (raw: string) => createHash("sha1").update(normalizeUrl(raw)).digest("hex").slice(0, 24);
