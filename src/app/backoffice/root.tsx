"use client";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/bo/AuthGate";
import { Backoffice } from "@/components/bo/Backoffice";
import { MobileApp } from "@/components/bo/mobile/MobileApp";

const PREF = "radar.vista";
/** Telemóvel a sério (não só uma janela estreita): pelo próprio browser. */
function isPhone() {
  const n = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return n.userAgentData?.mobile ?? /Android.+Mobile|iPhone|iPod|Windows Phone|Mobi/i.test(n.userAgent);
}

/** No telemóvel abre a vista rápida (pipeline); dá para mudar para a versão completa e voltar. */
function Switch() {
  const [phone, setPhone] = useState(false);
  const [quick, setQuick] = useState<boolean | null>(null);
  useEffect(() => {
    const p = isPhone(); setPhone(p);
    let pref: string | null = null; try { pref = localStorage.getItem(PREF); } catch { /* sem armazenamento */ }
    setQuick(p && pref !== "completa");
  }, []);
  const set = (q: boolean) => { try { localStorage.setItem(PREF, q ? "rapida" : "completa"); } catch { /* sem armazenamento */ } setQuick(q); window.scrollTo(0, 0); };
  if (quick === null) return <div className="loading">A carregar…</div>;
  return quick ? <MobileApp onFull={() => set(false)} /> : <Backoffice onQuick={phone ? () => set(true) : undefined} />;
}

export function BackofficeRoot() {
  return <div className="bo"><AuthGate><Switch /></AuthGate></div>;
}
