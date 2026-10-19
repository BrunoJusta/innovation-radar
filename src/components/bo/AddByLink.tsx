"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { createManual, Draft } from "@/lib/bo-actions";
import { Area, Category, Signal } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { useSession } from "./AuthGate";
import { DraftFields } from "./DraftFields";

type Step = "link" | "loading" | "review" | "saving";

/** Adicionar uma notícia à mão: link → a Gemini prepara → revisão com edição total → triagem ou aprovação. */
export function AddByLink({ areas, cats, signals, onClose, onDone }: {
  areas: Area[]; cats: Category[]; signals: Signal[]; onClose: () => void; onDone: (msg: string, aprovada: boolean) => void;
}) {
  const { email } = useSession();
  const [step, setStep] = useState<Step>("link");
  const [url, setUrl] = useState("");
  const [colar, setColar] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [d, setD] = useState<Draft | null>(null);
  const [vec, setVec] = useState<number[] | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && step !== "loading" && step !== "saving") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [step, onClose]);

  const preparar = async () => {
    setErro(""); setAviso("");
    if (!/^https?:\/\/\S+\.\S+/.test(url.trim())) { setErro("Cola um link completo, a começar por https://"); return; }
    setStep("loading");
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/preparar", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: url.trim(), texto: colar ? texto : "",
          areas: areas.map(({ id, nome, descricao }) => ({ id, nome, descricao })),
          cats: cats.map(({ id, nome, descricao, tipo }) => ({ id, nome, descricao, tipo })),
        }),
      });
      const j = await r.json().catch(() => ({ erro: `Erro ${r.status}` }));
      if (!r.ok) { setErro(j.erro || `Erro ${r.status}`); if (r.status === 422) setColar(true); setStep("link"); return; }
      setD({ ...j.rascunho, destaque: false }); setVec(j.vec || null); setAviso(j.aviso || ""); setStep("review");
    } catch { setErro("Não foi possível falar com o servidor. Verifica a ligação e tenta outra vez."); setStep("link"); }
  };

  const dup = d ? signals.find((s) => s.fontes?.some((f) => f.urlHash === d.fonte.urlHash)) : undefined;

  const guardar = async (aprovar: boolean) => {
    if (!d) return;
    if (!d.titulo.trim() || !d.resumo.trim()) { setErro("O título e o resumo não podem ficar vazios."); return; }
    setErro(""); setStep("saving");
    try {
      await createManual(d, vec, email, aprovar);
      onDone(aprovar ? "Notícia aprovada e publicada no radar" : "Notícia adicionada à triagem", aprovar);
    } catch (e) {
      setErro((e as { code?: string }).code === "permission-denied" ? "Sem permissão para gravar. Confirma que as regras do Firestore estão atualizadas." : "Não foi possível guardar. Tenta outra vez.");
      setStep("review");
    }
  };

  return (<>
    <div className="scrim" onClick={() => step === "link" && onClose()} />
    <div className={`mdl${step === "review" || step === "saving" ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="add-t">
      <div className="mdl-h">
        <h2 id="add-t">{step === "review" || step === "saving" ? "Rever notícia" : "Adicionar notícia por link"}</h2>
        <button className="btn icon" aria-label="Fechar" onClick={onClose} disabled={step === "loading" || step === "saving"}><Icon name="x" /></button>
      </div>

      {(step === "link" || step === "loading") && (
        <div className="mdl-b">
          <p className="hint">A Gemini lê o artigo e prepara o título, o resumo e a classificação. Revês e editas tudo antes de gravar.</p>
          <label className="fld"><span>Link do artigo</span>
            <input type="url" inputMode="url" autoFocus spellCheck={false} autoComplete="off" value={url} disabled={step === "loading"}
              onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !colar && preparar()} placeholder="https://www.site.com/artigo" /></label>
          {colar ? (
            <label className="fld"><span>Texto do artigo (opcional)</span>
              <textarea rows={7} value={texto} disabled={step === "loading"} onChange={(e) => setTexto(e.target.value)}
                placeholder="Para sites pagos ou que bloqueiam a leitura: cola aqui o texto do artigo." /></label>
          ) : (
            <button className="txtbtn" onClick={() => setColar(true)}><Icon name="plus" />Colar o texto do artigo</button>
          )}
          {erro && <p className="gerr" role="alert">{erro}</p>}
          <div className="factions">
            <button className="txtbtn" onClick={onClose} disabled={step === "loading"}>Cancelar</button>
            <button className="btn primary" onClick={preparar} disabled={step === "loading"}>
              {step === "loading" ? <><span className="spin" aria-hidden="true" />A preparar…</> : <><Icon name="sparkle" />Preparar notícia</>}
            </button>
          </div>
        </div>
      )}

      {(step === "review" || step === "saving") && d && (<>
        <div className="mdl-b scroll">
          {aviso && <div className="notice"><Icon name="warning-circle" /><span>{aviso}</span></div>}
          {dup && <div className="notice warn"><Icon name="warning-circle" /><span>Este link já existe no radar: «{dup.titulo}» ({dup.status === "approved" ? "aprovada" : dup.status === "rejected" ? "rejeitada" : "em triagem"}). Se gravares, fica duplicada.</span></div>}
          <DraftFields value={d} onChange={(p) => setD({ ...d, ...p })} areas={areas} cats={cats} withSource />
          {erro && <p className="gerr" role="alert">{erro}</p>}
        </div>
        <div className="mdl-f">
          <button className="txtbtn" onClick={() => { setStep("link"); setD(null); }} disabled={step === "saving"}><Icon name="arrow-u-up-left" />Outro link</button>
          <span className="sp" />
          <button className="btn" onClick={() => guardar(false)} disabled={step === "saving"}><Icon name="tray" />Guardar na triagem</button>
          <button className="btn primary" onClick={() => guardar(true)} disabled={step === "saving"}><Icon name="check" />Aprovar e publicar</button>
        </div>
      </>)}
    </div>
  </>);
}
