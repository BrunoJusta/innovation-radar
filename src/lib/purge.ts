"use client";
/**
 * Apagar depois do "Anular": ao rejeitar, a ficha sai logo da vista, mas só é apagada da base de dados
 * quando o aviso com "Anular" desaparece. Se a página fechar antes, a recolha diária apaga as que ficarem.
 */
const PRAZO = 6000; // um pouco mais do que o aviso (5 s)
const fila = new Map<string, { t: ReturnType<typeof setTimeout>; fn: () => Promise<unknown> }>();

export function agendarApagar(chave: string, fn: () => Promise<unknown>) {
  cancelarApagar(chave);
  const t = setTimeout(() => { fila.delete(chave); fn().catch((e) => console.error("Não foi possível apagar", chave, e)); }, PRAZO);
  fila.set(chave, { t, fn });
}
export function cancelarApagar(chave: string) {
  const x = fila.get(chave);
  if (x) { clearTimeout(x.t); fila.delete(chave); }
}
// Ao sair da página, tenta apagar já o que estava à espera
if (typeof window !== "undefined") window.addEventListener("pagehide", () => {
  fila.forEach((x, k) => { clearTimeout(x.t); x.fn().catch(() => {}); fila.delete(k); });
});
