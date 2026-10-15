"use client";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, Role } from "@/lib/types";
import { nowIso } from "@/lib/util";
import { Icon } from "@/components/Icon";
import { useSession } from "../AuthGate";
import { AdmHead, DangerBtn, errMsg, useFlash } from "./common";

export function UsersView() {
  const { email: me } = useSession();
  const [list, setList] = useState<AppUser[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const { flash, el } = useFlash();
  useEffect(() => onSnapshot(collection(db, "users"), (s) => setList(s.docs.map((d) => ({ ...d.data(), email: d.id }) as AppUser).sort((a, b) => a.email.localeCompare(b.email)))), []);

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return flash("Indica um email válido.");
    if (list.some((u) => u.email === e)) return flash("Esse utilizador já tem acesso.");
    try { await setDoc(doc(db, "users", e), { role, adicionadoEm: nowIso(), adicionadoPor: me }); setEmail(""); flash("Acesso dado a " + e); }
    catch (err) { flash(errMsg(err)); }
  };

  return (<>
    <AdmHead title="Utilizadores" text="Quem pode entrar no backoffice. Editores fazem a triagem; administradores gerem também fontes, categorias, utilizadores e definições." />
    <div className="form inline">
      <label className="fld wide"><span>Email Sogrape</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome.apelido@sogrape.pt" autoComplete="off" spellCheck={false} inputMode="email" onKeyDown={(e) => e.key === "Enter" && add()} /></label>
      <label className="fld"><span>Perfil</span><select value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="editor">Editor</option><option value="admin">Administrador</option></select></label>
      <button className="btn primary" onClick={add}><Icon name="plus" />Dar acesso</button>
    </div>
    <div className="rows">{list.map((u) => {
      const self = u.email === me;
      return (
        <div className="row" key={u.email}>
          <span className="av">{u.email.slice(0, 2).toUpperCase()}</span>
          <div className="rmain"><b>{u.nome || u.email.split("@")[0]}{self && <em> (tu)</em>}</b><span className="mtxt">{u.email}</span></div>
          <select className="rsel" value={u.role} disabled={self} aria-label="Perfil"
            onChange={(e) => updateDoc(doc(db, "users", u.email), { role: e.target.value }).then(() => flash("Perfil atualizado")).catch((er) => flash(errMsg(er)))}>
            <option value="editor">Editor</option><option value="admin">Administrador</option>
          </select>
          {self ? <span className="btn icon ghost" /> : <DangerBtn label="Remover acesso" onConfirm={() => deleteDoc(doc(db, "users", u.email)).then(() => flash("Acesso removido")).catch((er) => flash(errMsg(er)))} />}
        </div>);
    })}</div>
    {el}
  </>);
}
