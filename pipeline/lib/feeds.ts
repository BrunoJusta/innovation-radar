import { XMLParser } from "fast-xml-parser";
import { decodeEntities, htmlToText, UA } from "./text";

export type FeedItem = { url: string; title: string; date: string; author?: string; html: string };

const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const str = (x: unknown): string => {
  if (x == null) return "";
  if (typeof x === "string" || typeof x === "number") return String(x);
  if (typeof x === "object") { const o = x as Record<string, unknown>; return str(o["#text"] ?? o["@_href"] ?? ""); }
  return "";
};
const iso = (d: string) => { const t = Date.parse(d); return isNaN(t) ? new Date().toISOString() : new Date(t).toISOString(); };

/** Lê RSS 2.0 e Atom. */
export function parseFeed(xml: string): FeedItem[] {
  const p = new XMLParser({ ignoreAttributes: false, cdataPropName: false, processEntities: true, htmlEntities: true });
  const j = p.parse(xml);
  if (j.rss?.channel) {
    return arr(j.rss.channel.item).map((it: Record<string, unknown>) => ({
      url: str(it.link) || str(it.guid),
      title: decodeEntities(str(it.title)).trim(),
      date: iso(str(it.pubDate) || str(it["dc:date"])),
      author: str(it["dc:creator"]) || str(it.author) || undefined,
      html: str(it["content:encoded"]) || str(it.description),
    })).filter((i) => i.url && i.title);
  }
  if (j.feed) {
    return arr(j.feed.entry).map((e: Record<string, unknown>) => {
      const links = arr(e.link as unknown) as Record<string, string>[];
      const link = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") || links[0];
      return {
        url: link?.["@_href"] || "", title: decodeEntities(str(e.title)).trim(),
        date: iso(str(e.published) || str(e.updated)),
        author: str((e.author as Record<string, unknown>)?.name) || undefined,
        html: str(e.content) || str(e.summary),
      };
    }).filter((i) => i.url && i.title);
  }
  return [];
}

async function get(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, application/json, text/xml, */*" }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return r.text();
}

export async function fetchRss(url: string): Promise<FeedItem[]> { return parseFeed(await get(url)); }

/** WordPress REST API: {base}/wp-json/wp/v2/posts */
export async function fetchWp(base: string): Promise<FeedItem[]> {
  const b = base.replace(/\/+$/, "").replace(/\/wp-json.*$/, "");
  const raw = JSON.parse(await get(`${b}/wp-json/wp/v2/posts?per_page=20&_fields=link,title,date_gmt,content,excerpt`));
  return (raw as { link: string; title: { rendered: string }; date_gmt: string; content?: { rendered: string }; excerpt?: { rendered: string } }[])
    .map((p) => ({ url: p.link, title: htmlToText(p.title.rendered), date: iso(p.date_gmt + "Z"), html: p.content?.rendered || p.excerpt?.rendered || "" }));
}
