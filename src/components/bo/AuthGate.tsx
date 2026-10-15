"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, microsoftProvider } from "@/lib/firebase";
import { AppUser } from "@/lib/types";

type Ctx = { user: User; profile: AppUser; email: string; isAdmin: boolean };
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
      setCtx({ user: u, profile, email, isAdmin: profile.role === "admin" });
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
    <div className="gate">
      <div className="gatebox">
        <div className="gbrand">Radar de Inovação</div>
        {state === "loading" && <p className="gsub">A verificar a sessão…</p>}
        {state === "out" && (<>
          <h1>Backoffice</h1>
          <p className="gsub">Entra com a tua conta Microsoft da Sogrape para aprovar e gerir as notícias do radar.</p>
          <button className="btn primary lg" onClick={login}>Entrar com Microsoft</button>
          {err && <p className="gerr">{err}</p>}
        </>)}
        {state === "denied" && (<>
          <h1>Sem acesso</h1>
          <p className="gsub">A tua conta ({auth.currentUser ? emailOf(auth.currentUser) : ""}) ainda não tem acesso ao backoffice. Pede a um administrador do radar para te adicionar.</p>
          <button className="btn lg" onClick={() => signOut(auth)}>Sair e usar outra conta</button>
        </>)}
        <a className="gback" href="/">Voltar ao radar</a>
      </div>
    </div>
  );
}

export const logout = () => signOut(auth);
