import { createHash } from "node:crypto";

/**
 * Adresse IP de l'appelant, derrière les proxies habituels (Vercel, CDN…).
 * Renvoie "" si aucune IP n'est exploitable.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return (req.headers.get("x-real-ip") || "").trim();
}

const SALT =
  process.env.CRON_SECRET ||
  process.env.ADMIN_PASSWORD ||
  "selvema-net-dev-salt";

/**
 * Empreinte non réversible de l'IP (rate limiting). On ne stocke jamais l'IP
 * brute : seulement ce hash salé, tronqué.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}:${SALT}`).digest("hex").slice(0, 40);
}
