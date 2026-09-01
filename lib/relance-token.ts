import { createHmac, timingSafeEqual } from "node:crypto";
import { APP_URL } from "./resend";

/**
 * Petit jeton signé pour les liens « Oui / Non » des emails de relance.
 * Le prospect clique depuis sa boîte mail : le lien doit être infalsifiable
 * mais ne nécessite aucune connexion. On signe `<leadId>:<reponse>` en HMAC.
 */

const SECRET =
  process.env.CRON_SECRET ||
  process.env.ADMIN_PASSWORD ||
  "selvema-relance-dev-secret";

export type RelanceReponse = "oui" | "non";

export function signRelance(leadId: string, reponse: RelanceReponse): string {
  return createHmac("sha256", SECRET)
    .update(`${leadId}:${reponse}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyRelance(
  leadId: string,
  reponse: string,
  sig: string
): reponse is RelanceReponse {
  if (reponse !== "oui" && reponse !== "non") return false;
  const expected = signRelance(leadId, reponse);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** URL absolue du lien de réponse à placer dans un bouton d'email. */
export function relanceUrl(leadId: string, reponse: RelanceReponse): string {
  const s = signRelance(leadId, reponse);
  return `${APP_URL}/relance?l=${encodeURIComponent(leadId)}&r=${reponse}&s=${s}`;
}
