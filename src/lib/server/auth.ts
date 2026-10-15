/** Confirma o login e o acesso ao BO: o Firestore valida o token e as regras só deixam ler o próprio perfil. */
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sogrape-ai-studio";
const DB = process.env.NEXT_PUBLIC_FIRESTORE_DB || "innovationradar-prod";

export async function memberFromRequest(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    const email = String(payload.email || "").toLowerCase();
    if (!email) return null;
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents/users/${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    return r.ok ? email : null;
  } catch { return null; }
}
