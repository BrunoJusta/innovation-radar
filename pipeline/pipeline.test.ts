import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, urlHash } from "./lib/url";
import { matchKeywords, htmlToText } from "./lib/text";
import { parseFeed, cloudflareBlock, wpUrl } from "./lib/feeds";
import { cosine, lisbon } from "./lib/math";

test("normalizeUrl remove tracking, www, barra final e fragmento", () => {
  assert.equal(normalizeUrl("http://www.Site.com/a/b/?utm_source=x&id=2&fbclid=y#top"), "https://site.com/a/b?id=2");
  assert.equal(normalizeUrl("https://site.com/"), "https://site.com");
  assert.equal(urlHash("https://site.com/x/"), urlHash("https://www.site.com/x?utm_medium=rss"));
  assert.notEqual(urlHash("https://site.com/x"), urlHash("https://site.com/y"));
});

test("matchKeywords ignora acentos e respeita limites de palavra", () => {
  assert.deepEqual(matchKeywords("Novo vinho SEM ALCOOL chega ao mercado", ["sem álcool"]), ["sem álcool"]);
  assert.deepEqual(matchKeywords("A brand uses AI to plan", ["ai"]), ["ai"]);
  assert.deepEqual(matchKeywords("The rain in Spain", ["ai"]), []);
  assert.deepEqual(matchKeywords("Cerveja 0,0 da marca", ["0,0"]), ["0,0"]);
  assert.deepEqual(matchKeywords("non-alcoholic wine", ["non-alcoholic", "alcohol free"]), ["non-alcoholic"]);
});

test("htmlToText limpa tags e entidades", () => {
  assert.equal(htmlToText("<p>Olá &amp; adeus</p><script>x()</script><p>Fim&#8230;</p>"), "Olá & adeus\nFim…");
});

test("parseFeed lê RSS com content:encoded e Atom", () => {
  const rss = `<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
    <item><title>Título &amp; mais</title><link>https://a.pt/n1/</link><pubDate>Tue, 13 Oct 2026 08:00:00 +0000</pubDate><dc:creator><![CDATA[Ana]]></dc:creator>
    <description>curto</description><content:encoded><![CDATA[<p>Texto completo</p>]]></content:encoded></item>
    <item><title>Dois</title><link>https://a.pt/n2</link></item></channel></rss>`;
  const r = parseFeed(rss);
  assert.equal(r.length, 2);
  assert.equal(r[0].title, "Título & mais");
  assert.equal(r[0].author, "Ana");
  assert.equal(r[0].html, "<p>Texto completo</p>");
  assert.equal(r[0].date, "2026-10-13T08:00:00.000Z");
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>A</title><link rel="alternate" href="https://b.com/1"/><published>2026-10-01T10:00:00Z</published><summary>s</summary></entry></feed>`;
  assert.equal(parseFeed(atom)[0].url, "https://b.com/1");
});

test("cosine e hora de Lisboa", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.deepEqual(lisbon(new Date("2026-07-01T05:30:00Z")), { hour: 6, day: "2026-07-01" });
  assert.deepEqual(lisbon(new Date("2026-12-01T05:30:00Z")), { hour: 5, day: "2026-12-01" });
});

test("cloudflareBlock distingue bloqueio anti-robôs de site em baixo", () => {
  const H = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  assert.equal(cloudflareBlock(403, H({ server: "cloudflare", "cf-ray": "a4ae-SEA" })), true);
  assert.equal(cloudflareBlock(403, H({ server: "nginx" })), false);
  assert.equal(cloudflareBlock(503, H({ server: "cloudflare" }), "<title>Just a moment...</title>"), true);
  assert.equal(cloudflareBlock(503, H({ server: "cloudflare" }), "Service unavailable"), false);
  assert.equal(cloudflareBlock(429, H({ server: "cloudflare", "cf-mitigated": "challenge" })), true);
  assert.equal(cloudflareBlock(500, H({ server: "cloudflare" })), false);
});

import { domainOf, isOwnSite, startupId, siteUrl } from "./lib/startups";
test("startups: domínio, id e sites que não são próprios", () => {
  assert.equal(domainOf("https://www.Vinergy.io/about?x=1"), "vinergy.io");
  assert.equal(domainOf("vinergy.io"), "vinergy.io");
  assert.equal(siteUrl("http://www.vinergy.io/pt/"), "https://vinergy.io");
  assert.equal(startupId("tech.vinergy.io"), "tech-vinergy-io");
  assert.equal(isOwnSite("vinergy.io"), true);
  assert.equal(isOwnSite("linkedin.com"), false);
  assert.equal(isOwnSite("pt.linkedin.com"), false);
  assert.equal(isOwnSite("crunchbase.com"), false);
  assert.equal(isOwnSite(""), false);
});

import { extractJson } from "./lib/gemini";
test("extractJson lê o JSON de respostas em texto", () => {
  assert.deepEqual(extractJson('Aqui está:\n```json\n{"startups":[{"nome":"A"}]}\n```'), { startups: [{ nome: "A" }] });
  assert.deepEqual(extractJson('{"startups":[]} fim'), { startups: [] });
  assert.deepEqual(extractJson('lista: [{"nome":"B"}]'), [{ nome: "B" }]);
  assert.equal(extractJson("sem json nenhum"), null);
});

test("wpUrl junta o caminho da API e mantém os filtros", () => {
  assert.equal(wpUrl("https://site.com/"), "https://site.com/wp-json/wp/v2/posts?per_page=20&_fields=link%2Ctitle%2Cdate_gmt%2Ccontent%2Cexcerpt");
  const u = new URL(wpUrl("https://agfundernews.com/wp-json/wp/v2/posts?categories=772,773"));
  assert.equal(u.searchParams.get("categories"), "772,773");
  assert.equal(u.searchParams.get("per_page"), "20");
});
