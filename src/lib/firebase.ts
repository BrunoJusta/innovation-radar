"use client";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração web do Firebase. É pública por natureza (vai sempre para o browser) e a segurança
// está nas regras do Firestore. As variáveis NEXT_PUBLIC_* permitem trocar de projeto sem mexer no código.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCRT_YgVXRuHg6yPOeY0hb8PpV5lQCLUnU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sogrape-ai-studio.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sogrape-ai-studio",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sogrape-ai-studio.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "782851902471",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:782851902471:web:fc67b34677db0b38f52ea2",
};
const TENANT = process.env.NEXT_PUBLIC_MS_TENANT_ID || "d14bc227-42e9-426c-86cc-0f1efb561a07";

export const app = getApps().length ? getApp() : initializeApp(config);
export const db = getFirestore(app, process.env.NEXT_PUBLIC_FIRESTORE_DB || "innovationradar-prod");
export const auth = getAuth(app);

/** Login Microsoft restrito ao tenant da Sogrape. */
export function microsoftProvider() {
  const p = new OAuthProvider("microsoft.com");
  p.setCustomParameters({ tenant: TENANT, prompt: "select_account" });
  return p;
}
