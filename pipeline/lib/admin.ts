import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function adminDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Falta o secret FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço).");
  const sa = JSON.parse(raw);
  const app = getApps()[0] || initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const db = getFirestore(app, process.env.FIRESTORE_DB || "innovationradar-prod");
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}
