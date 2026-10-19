/**
 * Leitor mínimo de .xlsx no browser, sem dependências: abre o zip (DecompressionStream),
 * lê as strings partilhadas e devolve as linhas de uma folha como listas de valores.
 * Chega para ler ficheiros com um formato conhecido (por exemplo o Excel do dealflow).
 */
export type Celula = string | number | null;

type Entrada = { nome: string; metodo: number; tamanho: number; offset: number };

function entradas(buf: ArrayBuffer): Entrada[] {
  const v = new DataView(buf);
  // Fim do diretório central: assinatura 0x06054b50, procurada de trás para a frente
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("O ficheiro não é um Excel (.xlsx) válido.");
  const n = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Entrada[] = [];
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true), tamanho = v.getUint32(p + 20, true);
    const ln = v.getUint16(p + 28, true), le = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    out.push({ nome: dec.decode(new Uint8Array(buf, p + 46, ln)), metodo, tamanho, offset });
    p += 46 + ln + le + lc;
  }
  return out;
}

async function lerEntrada(buf: ArrayBuffer, e: Entrada): Promise<string> {
  const v = new DataView(buf);
  const ini = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const dados = new Uint8Array(buf, ini, e.tamanho);
  if (e.metodo === 0) return new TextDecoder().decode(dados);
  if (e.metodo !== 8) throw new Error("Compressão do Excel não suportada.");
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([dados]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}

const xml = (t: string) => new DOMParser().parseFromString(t, "application/xml");
const filhos = (el: Element | Document, tag: string) => Array.from(el.getElementsByTagNameNS("*", tag));

/** Índice da coluna a partir da referência da célula ("AB12" → 27). */
const colIdx = (ref: string) => { const l = ref.replace(/\d+/g, ""); let n = 0; for (const c of l) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

/** Lê uma folha pelo nome; devolve as linhas (índice 0 = linha 1 do Excel). */
export async function lerFolha(file: File | ArrayBuffer, folha: string): Promise<Celula[][]> {
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const ent = entradas(buf);
  const get = async (nome: string) => { const e = ent.find((x) => x.nome === nome); return e ? lerEntrada(buf, e) : ""; };

  // Folha pelo nome: workbook.xml (nome → r:id) e workbook.xml.rels (r:id → ficheiro)
  const wb = xml(await get("xl/workbook.xml"));
  const sh = filhos(wb, "sheet").find((s) => (s.getAttribute("name") || "").trim().toLowerCase() === folha.toLowerCase());
  if (!sh) throw new Error(`O ficheiro não tem a folha «${folha}».`);
  const rid = sh.getAttribute("r:id") || sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || "";
  const rels = xml(await get("xl/_rels/workbook.xml.rels"));
  const alvo = filhos(rels, "Relationship").find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target") || "";
  const caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, "")}`;

  const ss = await get("xl/sharedStrings.xml");
  const strings = ss ? filhos(xml(ss), "si").map((si) => filhos(si, "t").map((t) => t.textContent || "").join("")) : [];

  const doc = xml(await get(caminho));
  const linhas: Celula[][] = [];
  for (const row of filhos(doc, "row")) {
    const r = Number(row.getAttribute("r")) - 1;
    const cells: Celula[] = [];
    for (const c of filhos(row, "c")) {
      const t = c.getAttribute("t"), ref = c.getAttribute("r") || "";
      const vEl = filhos(c, "v")[0];
      let val: Celula = null;
      if (t === "s") val = vEl ? strings[Number(vEl.textContent)] ?? null : null;
      else if (t === "inlineStr") val = filhos(c, "t").map((x) => x.textContent || "").join("");
      else if (t === "str" || t === "e") val = vEl?.textContent ?? null;
      else if (t === "b") val = vEl ? Number(vEl.textContent) : null;
      else val = vEl && vEl.textContent !== "" ? Number(vEl.textContent) : null;
      cells[ref ? colIdx(ref) : cells.length] = val;
    }
    linhas[r] = Array.from(cells, (x) => (x === undefined ? null : x));
  }
  return Array.from(linhas, (x) => x || []);
}

/** Data de série do Excel (dias desde 1899-12-30) → AAAA-MM-DD. */
export const dataExcel = (n: number) => new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10);
