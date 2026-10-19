/**
 * Pesquisa das notícias do radar. Corre toda no browser sobre as notícias já carregadas.
 * Ignora acentos e maiúsculas, aceita várias palavras (todas têm de aparecer em algum campo)
 * e procura também pelo início das palavras ("desalc" encontra "desalcoolização").
 */

/** Texto sem acentos e em minúsculas, com o mapa de cada letra para a posição no texto original. */
export function fold(txt: string) {
  let out = "";
  const map: number[] = [];
  for (let i = 0; i < txt.length; i++) {
    const f = txt[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (let k = 0; k < f.length; k++) { out += f[k]; map.push(i); }
  }
  return { s: out, map };
}

export const foldStr = (txt: string) => fold(txt).s;

/** Palavras da pesquisa, sem acentos. Palavras soltas de 1 letra são ignoradas (exceto números). */
export function terms(q: string) {
  return [...new Set(foldStr(q).split(/[\s,;.]+/).filter((t) => t.length > 1 || /\d/.test(t)))];
}

export interface SearchDoc {
  id: string;
  titulo: string;
  resumo: string;
  entidades: string[];
  fontes: { titulo: string }[];
  areaNome: string;
  catNome: string;
  relevancia: number;
  data: string;
}

export interface SearchHit {
  id: string;
  score: number;
  /** Campos onde a pesquisa encontrou alguma coisa (para explicar o resultado). */
  em: ("titulo" | "resumo" | "entidades" | "area" | "categoria" | "fontes")[];
  /** Entidades que correspondem à pesquisa. */
  entidades: string[];
}

const W = { titulo: 6, entidades: 5, categoria: 3, area: 3, resumo: 1.6, fontes: 1 } as const;
const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);

/** Palavras curtas ("ia", "ai") só contam no início de uma palavra, para "ia" não encontrar "Diageo". */
const SHORT = 3;

/** Pontos de uma palavra num campo: começo de palavra vale mais e palavra inteira vale ainda mais. */
function termScore(field: string, t: string) {
  let best = 0, n = 0, i = field.indexOf(t);
  while (i !== -1 && n < 6) {
    const start = !isWordChar(field[i - 1]);
    if (!start && t.length <= SHORT) { i = field.indexOf(t, i + 1); continue; }
    const whole = start && !isWordChar(field[i + t.length]);
    best = Math.max(best, whole ? 1 : start ? 0.8 : 0.45);
    n++;
    i = field.indexOf(t, i + t.length);
  }
  // Repetições contam um pouco (mais vezes no resumo = mais sobre o tema)
  return best ? best + Math.min(n - 1, 4) * 0.08 : 0;
}

export function search(docs: SearchDoc[], q: string): SearchHit[] {
  const ts = terms(q);
  if (!ts.length) return [];
  const phrase = ts.length > 1 ? foldStr(q).trim().replace(/\s+/g, " ") : "";
  const out: SearchHit[] = [];
  for (const d of docs) {
    const f = {
      titulo: foldStr(d.titulo), resumo: foldStr(d.resumo), entidades: d.entidades.map(foldStr).join(" · "),
      categoria: foldStr(d.catNome), area: foldStr(d.areaNome), fontes: d.fontes.map((x) => foldStr(x.titulo)).join(" · "),
    };
    let score = 0, ok = true;
    const em = new Set<SearchHit["em"][number]>();
    for (const t of ts) {
      let ts_ = 0;
      for (const k of Object.keys(W) as (keyof typeof W)[]) {
        const s = termScore(f[k], t);
        if (s) { ts_ += s * W[k]; em.add(k); }
      }
      if (!ts_) { ok = false; break; }
      score += ts_;
    }
    if (!ok) continue;
    // A frase inteira seguida vale um bónus
    if (phrase && (f.titulo.includes(phrase) || f.resumo.includes(phrase))) score *= 1.35;
    // Desempate: relevância dada pela Gemini e notícias mais recentes
    const dias = Math.max(0, (Date.now() - new Date(d.data).getTime()) / 864e5);
    score += d.relevancia * 0.02 + Math.max(0, 1 - dias / 365) * 0.6;
    const ents = d.entidades.filter((e) => { const fe = foldStr(e); return ts.some((t) => termScore(fe, t) > 0); });
    out.push({ id: d.id, score, em: [...em], entidades: ents });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Partes do texto com as palavras da pesquisa marcadas. */
export function marks(txt: string, ts: string[]): { t: string; m: boolean }[] {
  if (!ts.length || !txt) return [{ t: txt, m: false }];
  const { s, map } = fold(txt);
  const hit = new Uint8Array(txt.length);
  for (const t of ts) {
    let i = s.indexOf(t);
    while (i !== -1) {
      if (t.length <= SHORT && isWordChar(s[i - 1])) { i = s.indexOf(t, i + 1); continue; }
      const a = map[i], b = map[i + t.length - 1];
      for (let k = a; k <= b; k++) hit[k] = 1;
      i = s.indexOf(t, i + t.length);
    }
  }
  const parts: { t: string; m: boolean }[] = [];
  for (let i = 0; i < txt.length; i++) {
    const m = !!hit[i];
    if (parts.length && parts[parts.length - 1].m === m) parts[parts.length - 1].t += txt[i];
    else parts.push({ t: txt[i], m });
  }
  return parts;
}

/** Excerto do resumo à volta da primeira palavra encontrada (com reticências quando corta). */
export function snippet(txt: string, ts: string[], len = 190) {
  const clean = txt.replace(/\s+/g, " ").trim();
  if (clean.length <= len) return clean;
  const { s, map } = fold(clean);
  let first = -1;
  for (const t of ts) {
    let i = s.indexOf(t);
    while (i !== -1 && t.length <= SHORT && isWordChar(s[i - 1])) i = s.indexOf(t, i + 1);
    if (i !== -1 && (first === -1 || i < first)) first = i;
  }
  if (first === -1) return clean.slice(0, len).replace(/\s+\S*$/, "") + "…";
  const at = map[first];
  let a = Math.max(0, at - Math.round(len * 0.3));
  if (a > 0) { const sp = clean.indexOf(" ", a); a = sp === -1 ? a : sp + 1; }
  let b = Math.min(clean.length, a + len);
  if (b < clean.length) { const sp = clean.lastIndexOf(" ", b); b = sp > a ? sp : b; }
  return (a > 0 ? "…" : "") + clean.slice(a, b) + (b < clean.length ? "…" : "");
}
