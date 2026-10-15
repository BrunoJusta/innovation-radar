"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, microsoftProvider } from "@/lib/firebase";
import { AppUser } from "@/lib/types";

type Ctx = { user: User; profile: AppUser; email: string; isAdmin: boolean; canPipeline: boolean };
const SessionCtx = createContext<Ctx | null>(null);
export const useSession = () => { const c = useContext(SessionCtx); if (!c) throw new Error("Sem sessão"); return c; };

const emailOf = (u: User) => (u.email || u.providerData.find((p) => p.email)?.email || "").toLowerCase();

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "out" | "denied" | "in">("loading");
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setState("out"); setCtx(null); return; }
    const email = emailOf(u);
    try {
      const p = await getDoc(doc(db, "users", email));
      if (!p.exists()) { setState("denied"); setCtx(null); return; }
      const profile = { email, ...p.data() } as AppUser;
      setCtx({ user: u, profile, email, isAdmin: profile.role === "admin", canPipeline: profile.role === "admin" });
      setState("in");
    } catch (e) { console.error(e); setState("denied"); }
  }), []);

  const login = async () => {
    setErr("");
    try { await signInWithPopup(auth, microsoftProvider()); }
    catch (e: unknown) {
      const code = (e as { code?: string }).code || "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request")
        setErr("Não foi possível entrar. Confirma que estás a usar a tua conta Microsoft da Sogrape e tenta outra vez.");
    }
  };

  if (state === "in" && ctx) return <SessionCtx.Provider value={ctx}>{children}</SessionCtx.Provider>;

  return (
    <div className="sg">
      <GateRadar />
      <main className="sg-in">
        <img className="sg-logo" src="/brand/sogrape-logo-white.svg" alt="Sogrape" width={148} height={56} />
        <div className="sg-body">
          <span className="sg-eye">Backoffice</span>
          <h1>Radar de Inovação</h1>
          {state === "loading" && <p className="sg-sub" role="status"><span className="sg-spin" aria-hidden="true" />A verificar a sessão…</p>}
          {state === "out" && (<>
            <p className="sg-sub">As notícias e as startups que interessam à Sogrape, num só sítio. Entra para decidir o que segue para o radar.</p>
            <button className="sg-btn" onClick={login}>
              <img src="/brand/sogrape-icon.svg" alt="" width={18} height={24} aria-hidden="true" />Entrar com conta Sogrape</button>
            {err && <p className="sg-err" role="alert">{err}</p>}
          </>)}
          {state === "denied" && (<>
            <p className="sg-sub">A tua conta ({auth.currentUser ? emailOf(auth.currentUser) : ""}) ainda não tem acesso ao backoffice. Pede a um administrador do radar para te adicionar.</p>
            <button className="sg-btn ghost" onClick={() => signOut(auth)}>Sair e usar outra conta</button>
          </>)}
        </div>
        <a className="sg-back" href="/">Voltar ao radar público</a>
      </main>
    </div>
  );
}

/** Fundo do ecrã de entrada: anéis do radar, pulsos, varrimento e sinais a acender. */
function GateRadar() {
  const pontos = [[-150, -60, 0], [90, -170, 1.1], [210, 40, 2.3], [-60, 160, 3.2], [40, 70, .6], [-250, 120, 1.8], [300, -130, 2.9], [-120, -260, 3.8], [160, 250, 4.4], [-330, -40, 5.1]];
  return (
    <div className="sg-bg" aria-hidden="true">
      <div className="sg-radar">
        <svg viewBox="-500 -500 1000 1000">
          {[90, 180, 270, 360, 450].map((r) => <circle key={r} className="sg-ring" r={r} />)}
          <circle className="sg-dash" r={225} />
          <circle className="sg-dash rev" r={405} />
          <line className="sg-axis" x1={-480} y1={0} x2={480} y2={0} /><line className="sg-axis" x1={0} y1={-480} x2={0} y2={480} />
          {pontos.map(([x, y, d], k) => <g key={k} style={{ ["--d" as string]: `${d}s` }}>
            <circle className="sg-ping" cx={x} cy={y} r={7} /><circle className={`sg-dot${k % 3 === 0 ? " c" : ""}`} cx={x} cy={y} r={k % 3 === 0 ? 7 : 5} /></g>)}
          <circle className="sg-core" r={10} />
        </svg>
        <div className="sg-sweep" />
        {[0, 1, 2].map((k) => <span key={k} className="sg-pulse" style={{ ["--k" as string]: k }} />)}
      </div>
    </div>
  );
}

export const logout = () => signOut(auth);
