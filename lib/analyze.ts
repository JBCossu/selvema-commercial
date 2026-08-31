import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CHAT_MODEL } from "./anthropic";

const MAX_PAGE_CHARS = 14000;

/** Bloque les URL locales / réseaux privés (garde-fou SSRF basique). */
export function isPublicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return u;
}

/** Récupère l'URL et en extrait le texte visible (balises retirées). */
export async function fetchPageText(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SelvemaBot/1.0; +https://selvema.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html") && !type.includes("text")) {
      throw new Error("La page n'est pas au format HTML.");
    }
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 40) {
    throw new Error("Trop peu de texte exploitable sur cette page.");
  }
  return text.slice(0, MAX_PAGE_CHARS);
}

/** Demande au modèle un prompt de configuration complet pour le chatbot. */
export async function generateChatbotConfig(
  pageText: string,
  sourceUrl: string
): Promise<string> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1600,
    system: `Tu es consultant pour Selvema. À partir du contenu brut du site d'une agence immobilière, tu rédiges sa BASE DE CONNAISSANCES en français : le document de référence que consultera son assistant conversationnel pour répondre aux visiteurs.

Rends UNIQUEMENT le document, sans phrase d'introduction ni commentaire. N'y mets aucune consigne de comportement pour l'assistant (ton, façon de répondre, qualification des prospects) : uniquement des FAITS sur l'agence. Structure exacte, avec ces titres :

## Description de l'agence
(2-4 phrases : qui est l'agence, son histoire, son positionnement, son équipe. Uniquement ce qui ressort du site.)

## Services
(Liste à puces des prestations : achat, vente, location, gestion locative, estimation, syndic, etc. Uniquement ce qui est mentionné.)

## Zones couvertes
(Villes, quartiers, secteurs d'intervention mentionnés. Si rien n'est explicite, écris "À préciser".)

## Biens disponibles
(Les biens en vente ou en location listés sur la page, un par ligne avec les infos clés. Si aucun n'apparaît, écris "Aucun bien listé sur cette page — à tenir à jour manuellement.")

## FAQ probable
(4 à 7 questions qu'un visiteur poserait, avec une réponse courte plausible fondée sur le site. Format :
Q : …
R : …)

Règles : n'invente pas de chiffres, de prix ou de noms absents du contenu. Reste factuel et concis. Tout ce qui est incertain est marqué "À préciser".`,
    messages: [
      {
        role: "user",
        content: `Site analysé : ${sourceUrl}\n\nContenu brut de la page :\n"""\n${pageText}\n"""`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
