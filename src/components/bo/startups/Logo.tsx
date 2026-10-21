"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { guardarLogo, procurarLogo, reduzirImagem } from "@/lib/logo";

/** Logótipo da startup, ou a inicial quando não há. */
export function Logo({ nome, logo, className = "slogo" }: { nome: string; logo?: string; className?: string }) {
  return logo ? <span className={`${className} haslogo`}><img src={logo} alt="" /></span> : <span className={className}>{nome.slice(0, 1).toUpperCase()}</span>;
}

/** Logótipo editável: carregar uma imagem, procurar no site ou tirar. */
export function LogoEditor({ nome, logo, site, alvo, notify }: { nome: string; logo?: string; site: string; alvo: { startupId?: string; dealId?: string }; notify: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  const run = async (f: () => Promise<void>) => { setBusy(true); setMenu(false); try { await f(); } catch (e) { notify((e as Error).message || "Não foi possível guardar o logótipo."); } setBusy(false); };
  return (
    <div className="logoed">
      <button type="button" className="logobtn" title="Mudar o logótipo" aria-label="Mudar o logótipo" aria-expanded={menu} onClick={() => setMenu(!menu)} disabled={busy}>
        <Logo nome={nome} logo={logo} className="slogo lg" />{busy ? <span className="spin" aria-hidden="true" /> : <span className="logoe"><Icon name="pencil-simple" size={12} /></span>}
      </button>
      <input ref={inp} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(async () => { await guardarLogo(alvo, await reduzirImagem(f)); notify("Logótipo guardado"); }); }} />
      {menu && <div className="logomenu" role="menu">
        <button role="menuitem" onClick={() => inp.current?.click()}><Icon name="upload-simple" />Carregar imagem</button>
        {site && <button role="menuitem" onClick={() => run(async () => { const l = await procurarLogo(site); if (!l) throw new Error("Não encontrei o logótipo no site. Carrega uma imagem."); await guardarLogo(alvo, l); notify("Logótipo encontrado e guardado"); })}><Icon name="magnifying-glass" />Procurar no site</button>}
        {logo && <button role="menuitem" onClick={() => run(async () => { await guardarLogo(alvo, null); notify("Logótipo tirado"); })}><Icon name="trash" />Tirar logótipo</button>}
      </div>}
    </div>
  );
}
