/** Confirma o login e o acesso ao BO: o Firestore valida o token e as regras só deixam ler o próprio perfil. */
import { PROMPT_SCOUTING } from "../scouting";

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

/** Lê um campo de texto de um documento com as permissões de quem fez o pedido (as regras do Firestore aplicam-se). */
export async function readTextField(req: Request, path: string, field: string, /** Valor quando o documento não existe. */ seFaltar = ""): Promise<string> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents/${path}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (r.status === 404) return seFaltar;
    if (!r.ok) return "";
    const j = await r.json();
    return j?.fields?.[field]?.stringValue || "";
  } catch { return ""; }
}

/** Contexto da pesquisa de startups: o prompt de scouting (o sugerido enquanto não for guardado) e as guidelines de investimento. */
export async function contextoDe(req: Request) {
  const [prompt, guidelines] = await Promise.all([readTextField(req, "config/scouting", "texto", PROMPT_SCOUTING), readTextField(req, "config/investimento", "texto")]);
  return { prompt, guidelines };
}
