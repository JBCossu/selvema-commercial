import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CHAT_MODEL } from "./anthropic";

/* ------------------------------------------------------------------ *
 *  Réglages du crawl
 *  maxDuration de la route = 60 s : le crawl a un budget de temps fixe
 *  et le reste est laissé au modèle.
 * ------------------------------------------------------------------ */

const MAX_PAGES = 20; // plafond dur demandé
const REQUEST_DELAY_MS = 500; // pause de politesse entre deux requêtes
const PER_PAGE_TIMEOUT_MS = 7_000; // abandon d'une page trop lente
const CRAWL_BUDGET_MS = 24_000; // temps total alloué à l'exploration
const MIN_TEXT_CHARS = 40; // en dessous, page ignorée

const HOME_PAGE_CHARS = 14_000; // texte gardé pour la page d'accueil
const PROPERTY_PAGE_CHARS = 9_000; // texte gardé pour une fiche de bien
const GENERIC_PAGE_CHARS = 5_000; // texte gardé pour les autres pages
const TOTAL_TEXT_BUDGET = 55_000; // total agrégé envoyé au modèle

export type PageKind = "accueil" | "bien immobilier" | "page interne";

export type ScrapedPage = {
  url: string;
  title: string;
  text: string;
  kind: PageKind;
};

/** Indices de rendu JavaScript relevés sur une page. */
export type JsSignals = {
  htmlBytes: number;
  textChars: number;
  scriptBytes: number;
  frameworks: string[];
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 *  Garde-fou SSRF : bloque les URL locales / réseaux privés
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 *  HTML -> texte visible
 * ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&eacute;": "é",
  "&egrave;": "è",
  "&ecirc;": "ê",
  "&euml;": "ë",
  "&agrave;": "à",
  "&acirc;": "â",
  "&aacute;": "á",
  "&ccedil;": "ç",
  "&ocirc;": "ô",
  "&ouml;": "ö",
  "&ugrave;": "ù",
  "&ucirc;": "û",
  "&uuml;": "ü",
  "&icirc;": "î",
  "&iuml;": "ï",
  "&ntilde;": "ñ",
  "&oelig;": "œ",
  "&laquo;": "«",
  "&raquo;": "»",
  "&euro;": "€",
  "&pound;": "£",
  "&hellip;": "…",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
  "&ndash;": " ",
  "&mdash;": " ",
  "&deg;": "°",
  "&sup2;": "²",
  "&times;": "x",
  "&middot;": "·",
  "&bull;": "·",
};

function safeCodePoint(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff) return " ";
  try {
    return String.fromCodePoint(n);
  } catch {
    return " ";
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&[a-z0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ");
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(
        /<\/(p|div|li|h[1-6]|br|tr|section|article|dd|dt|td|th|figcaption|blockquote)>/gi,
        "\n"
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitle(html: string): string {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const raw = (h1 || title || "").replace(/<[^>]+>/g, " ");
  return decodeEntities(raw).replace(/\s+/g, " ").trim().slice(0, 160);
}

/* ------------------------------------------------------------------ *
 *  Récupération d'une page : HTML brut + texte + titre
 * ------------------------------------------------------------------ */

type FetchedPage = { html: string; text: string; title: string };

async function fetchPage(url: URL, timeoutMs: number): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1_500, timeoutMs)
  );
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
    // Une redirection a pu nous emmener ailleurs : on revalide.
    if (res.url && !isPublicHttpUrl(res.url)) {
      throw new Error("Redirection vers une adresse non autorisée.");
    }
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html") && !type.includes("text")) {
      throw new Error("La page n'est pas au format HTML.");
    }
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  return { html, text: htmlToText(html), title: extractTitle(html) };
}

/**
 * Compat : texte visible d'une seule page (page d'accueil, contrôle rapide…).
 */
export async function fetchPageText(url: URL): Promise<string> {
  const { text } = await fetchPage(url, 12_000);
  if (text.length < MIN_TEXT_CHARS) {
    throw new Error("Trop peu de texte exploitable sur cette page.");
  }
  return text.slice(0, HOME_PAGE_CHARS);
}

/* ------------------------------------------------------------------ *
 *  Extraction et priorisation des liens internes
 * ------------------------------------------------------------------ */

const SKIP_EXT =
  /\.(pdf|docx?|xlsx?|pptx?|odt|zip|rar|7z|gz|png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?|mp4|webm|mov|avi|mkv|mp3|wav|ogg|css|js|mjs|json|xml|rss|txt|csv)(\?|#|$)/i;

function dedupeKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return host + path + (u.search || "");
  } catch {
    return rawUrl;
  }
}

function sameSite(a: URL, b: URL): boolean {
  const ha = a.hostname.toLowerCase().replace(/^www\./, "");
  const hb = b.hostname.toLowerCase().replace(/^www\./, "");
  return ha === hb || ha.endsWith("." + hb) || hb.endsWith("." + ha);
}

type Link = { url: string; key: string; anchor: string; inNav: boolean };

function extractLinks(html: string, base: URL): Link[] {
  // Repère grossièrement les zones de navigation pour booster leurs liens.
  const navZones: string[] = [];
  for (const m of Array.from(html.matchAll(/<nav\b[\s\S]*?<\/nav>/gi)))
    navZones.push(m[0]);
  for (const m of Array.from(html.matchAll(/<header\b[\s\S]*?<\/header>/gi)))
    navZones.push(m[0]);
  const navBlob = navZones.join(" ").toLowerCase();

  const out: Link[] = [];
  const seen = new Set<string>();
  const anchors = Array.from(
    html.matchAll(
      /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    )
  );
  for (const m of anchors) {
    const rawHref = m[1].split("#")[0].trim();
    if (!rawHref || /^(mailto:|tel:|javascript:|data:|sms:)/i.test(rawHref)) {
      continue;
    }
    let abs: URL;
    try {
      abs = new URL(rawHref, base);
    } catch {
      continue;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    if (!sameSite(abs, base)) continue;
    if (SKIP_EXT.test(abs.pathname)) continue;
    if (!isPublicHttpUrl(abs.toString())) continue;

    abs.hash = "";
    const url = abs.toString();
    const key = dedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);

    const anchor = decodeEntities(m[2].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    const inNav = navBlob.includes(rawHref.toLowerCase());
    out.push({ url, key, anchor, inNav });
  }
  return out;
}

const KW_ABOUT = [
  "propos",
  "a-propos",
  "apropos",
  "qui-sommes",
  "qui-somme",
  "notre-agence",
  "l-agence",
  "histoire",
  "valeurs",
  "engagement",
];
const KW_TEAM = ["equipe", "team", "collaborateur", "negociateur", "conseillers"];
const KW_CONTACT = [
  "contact",
  "nous-contacter",
  "coordonnees",
  "acces",
  "plan-acces",
  "horaires",
  "rendez-vous",
];
const KW_FAQ = ["faq", "questions", "aide", "help"];
const KW_TRUST = [
  "avis",
  "temoignage",
  "temoignages",
  "testimonial",
  "references",
  "confiance",
];
const KW_SERVICES = [
  "service",
  "services",
  "prestation",
  "prestations",
  "honoraires",
  "tarif",
  "tarifs",
  "estimation",
  "estimer",
  "gestion-locative",
  "syndic",
  "vendre",
  "acheter",
  "louer",
];
const KW_PROPERTY = [
  "bien",
  "biens",
  "annonce",
  "annonces",
  "offre",
  "offres",
  "propriete",
  "proprietes",
  "catalogue",
  "nos-biens",
  "a-vendre",
  "a-louer",
  "vente",
  "location",
  "achat",
  "immobilier",
  "listing",
  "property",
  "properties",
  "reference",
  "ref-",
  "lot-",
  "maison",
  "appartement",
  "terrain",
];
const KW_NEWS = [
  "actualite",
  "actualites",
  "actu",
  "blog",
  "news",
  "conseil",
  "conseils",
  "guide",
  "guides",
];

function scoreLink(l: Link): number {
  const hay = `${l.url} ${l.anchor}`.toLowerCase();
  const hit = (list: string[], pts: number) =>
    list.some((k) => hay.includes(k)) ? pts : 0;

  let s = 0;
  if (l.inNav) s += 6;
  s += hit(KW_ABOUT, 9);
  s += hit(KW_TEAM, 9);
  s += hit(KW_CONTACT, 9);
  s += hit(KW_FAQ, 9);
  s += hit(KW_TRUST, 8);
  s += hit(KW_SERVICES, 7);
  s += hit(KW_PROPERTY, 8);
  s += hit(KW_NEWS, 3);
  if (l.anchor) s += 1;

  // Les pages de pagination n'apportent rien de neuf : on les garde
  // accessibles mais après les vraies pages de contenu.
  if (/(?:[?&]page=\d+|\/page[-/]\d+|-p-?\d+\.|page-\d+\.)/i.test(l.url)) s -= 4;

  let depth = 0;
  try {
    depth = new URL(l.url).pathname.split("/").filter(Boolean).length;
  } catch {
    /* ignore */
  }
  if (depth >= 4) s -= 2;
  return s;
}

function looksLikeProperty(url: string, text: string): boolean {
  const u = url.toLowerCase();
  const urlHint = KW_PROPERTY.some((k) => u.includes(k));
  const priceish = /\d[\d\s. ]{2,}\s?(€|eur\b|euros)/i.test(text);
  const areaish = /\b\d{1,4}\s?(m²|m2|m\s?carr)/i.test(text);
  const roomsish = /\b\d\s?(pi[eè]ces?|chambres?|[TFtf]\d)\b/.test(text);
  const dpeish = /\b(DPE|GES|classe\s+[ée]nerg|bilan\s+[ée]nerg|honoraires)/i.test(
    text
  );
  const signals = [priceish, areaish, roomsish, dpeish].filter(Boolean).length;
  return (urlHint && signals >= 2) || signals >= 3;
}

/* ------------------------------------------------------------------ *
 *  Détection d'un site rendu massivement en JavaScript (SPA)
 * ------------------------------------------------------------------ */

const FRAMEWORK_PATTERNS: [string, RegExp][] = [
  ["Next.js", /__NEXT_DATA__|\/_next\/static\/|id="__next"/i],
  ["Nuxt", /__NUXT__|\/_nuxt\/|id="__nuxt"/i],
  ["Gatsby", /id="___gatsby"|\/page-data\/|gatsby-chunk/i],
  ["React", /data-reactroot|react-dom(?:\.production)?(?:\.min)?\.js|\bReactDOM\b|_react/i],
  ["Angular", /ng-version="|\bng-app\b|\bng-controller\b|polyfills(?:-[\w]+)?\.js|zone\.js/i],
  ["Vue", /data-v-app|__vue__|\bVue(?:\.runtime)?(?:\.global)?(?:\.prod)?\.min?\.js/i],
  ["Svelte", /\bsvelte-[a-z0-9]{6}\b|__svelte/i],
  ["Ember", /\bember-application\b|id="ember\d/i],
];

/** Relève les indices de JS sur le HTML brut d'une page. */
function jsSignalsFor(html: string, text: string): JsSignals {
  let scriptBytes = 0;
  for (const m of Array.from(
    html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)
  )) {
    scriptBytes += m[0].length;
  }
  const frameworks: string[] = [];
  for (const [name, re] of FRAMEWORK_PATTERNS) {
    if (re.test(html)) frameworks.push(name);
  }
  return { htmlBytes: html.length, textChars: text.length, scriptBytes, frameworks };
}

/**
 * À partir des indices relevés sur toutes les pages récupérées, décide si le
 * site dépend trop du JavaScript pour être analysé de façon fiable. Signaux :
 * frameworks JS détectés + peu de texte réel, HTML surtout composé de scripts,
 * ou pages quasi vides malgré plusieurs visites.
 */
export function detectJsHeavy(signals: JsSignals[]): boolean {
  const n = signals.length;
  if (!n) return false;

  const frameworkPages = signals.filter((s) => s.frameworks.length > 0).length;
  const avgText = signals.reduce((a, s) => a + s.textChars, 0) / n;
  const avgScriptRatio =
    signals.reduce(
      (a, s) => a + (s.htmlBytes ? s.scriptBytes / s.htmlBytes : 0),
      0
    ) / n;
  const avgTextRatio =
    signals.reduce(
      (a, s) => a + (s.htmlBytes ? s.textChars / s.htmlBytes : 0),
      0
    ) / n;
  const thinPages = signals.filter((s) => s.textChars < 400).length;

  // Framework SPA détecté ET peu de texte réellement rendu côté serveur.
  if (frameworkPages > 0 && avgText < 800) return true;
  // Le HTML est presque entièrement du <script>, quasi aucun texte visible.
  if (avgScriptRatio > 0.5 && avgTextRatio < 0.03) return true;
  // Coquille quasi vide accompagnée de scripts (SPA non identifiée).
  if (avgText < 150 && avgScriptRatio > 0.15) return true;
  // La majorité des pages visitées sont quasi vides.
  if (n >= 3 && thinPages >= Math.ceil(n * 0.6) && avgText < 500) return true;

  return false;
}

/* ------------------------------------------------------------------ *
 *  Crawl : parcours en largeur, priorisé, borné en pages et en temps
 * ------------------------------------------------------------------ */

export async function crawlSite(start: URL): Promise<{
  pages: ScrapedPage[];
  jsWarning: boolean;
}> {
  const deadline = Date.now() + CRAWL_BUDGET_MS;

  const visited = new Set<string>();
  const pages: ScrapedPage[] = [];
  const jsSignals: JsSignals[] = [];

  type FrontierItem = Link & { score: number };
  const startUrl = start.toString();
  let frontier: FrontierItem[] = [
    {
      url: startUrl,
      key: dedupeKey(startUrl),
      anchor: "Accueil",
      inNav: true,
      score: 1_000,
    },
  ];

  while (
    frontier.length &&
    pages.length < MAX_PAGES &&
    Date.now() < deadline
  ) {
    frontier.sort((a, b) => b.score - a.score);
    const current = frontier.shift()!;
    if (visited.has(current.key)) continue;
    visited.add(current.key);

    let target: URL | null = isPublicHttpUrl(current.url);
    if (!target) continue;

    const remaining = deadline - Date.now();
    if (remaining < 1_500) break;

    let fetched: FetchedPage;
    try {
      fetched = await fetchPage(
        target,
        Math.min(PER_PAGE_TIMEOUT_MS, remaining)
      );
    } catch {
      // Une page en échec n'interrompt pas l'analyse.
      continue;
    }

    // Relevé des indices de rendu JS, même si la page a trop peu de texte
    // pour entrer dans le corpus (c'est justement un signal de SPA).
    jsSignals.push(jsSignalsFor(fetched.html, fetched.text));

    if (fetched.text.length >= MIN_TEXT_CHARS) {
      const isHome = pages.length === 0;
      const kind: PageKind = isHome
        ? "accueil"
        : looksLikeProperty(current.url, fetched.text)
        ? "bien immobilier"
        : "page interne";
      const cap =
        kind === "accueil"
          ? HOME_PAGE_CHARS
          : kind === "bien immobilier"
          ? PROPERTY_PAGE_CHARS
          : GENERIC_PAGE_CHARS;
      pages.push({
        url: current.url,
        title: fetched.title || current.anchor || target.hostname,
        text: fetched.text.slice(0, cap),
        kind,
      });
    }

    if (pages.length < MAX_PAGES) {
      for (const link of extractLinks(fetched.html, target)) {
        if (visited.has(link.key)) continue;
        if (frontier.some((f) => f.key === link.key)) continue;
        frontier.push({ ...link, score: scoreLink(link) });
      }
      if (frontier.length > 250) {
        frontier.sort((a, b) => b.score - a.score);
        frontier = frontier.slice(0, 250);
      }
    }

    // Politesse : pause entre deux requêtes, si le budget le permet.
    if (
      frontier.length &&
      pages.length < MAX_PAGES &&
      Date.now() + REQUEST_DELAY_MS < deadline
    ) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return { pages, jsWarning: detectJsHeavy(jsSignals) };
}

/* ------------------------------------------------------------------ *
 *  Génération de la base de connaissances
 * ------------------------------------------------------------------ */

const KB_SYSTEM = `Tu es consultant pour Selvema. À partir du contenu brut de PLUSIEURS pages du site d'une agence immobilière (accueil, à propos, équipe, contact, FAQ, fiches de biens, actualités…), tu rédiges sa BASE DE CONNAISSANCES en français : le document de référence que consultera son assistant conversationnel pour répondre aux visiteurs.

Objectif : que l'assistant connaisse l'agence et son site aussi bien qu'un employé qui y travaille depuis cinq ans. Sois EXHAUSTIF. Ne laisse de côté aucun détail concret présent dans le contenu (chiffres, noms, adresses, caractéristiques de biens, horaires, conditions…).

Rends UNIQUEMENT le document, sans phrase d'introduction ni commentaire. N'y mets AUCUNE consigne de comportement pour l'assistant (ton, façon de répondre, qualification des prospects) : uniquement des FAITS sur l'agence. Respecte exactement cette structure et ces titres :

## Description de l'agence
2 à 5 phrases : qui est l'agence, son histoire, son ancienneté, son positionnement, ses chiffres clés, ses labels ou réseaux. Uniquement ce qui ressort du site.

## Services
Liste à puces de toutes les prestations mentionnées (achat, vente, location, gestion locative, estimation, syndic, viager, neuf, conseil en investissement, home staging…). Précise pour chacune les conditions ou honoraires si le site les donne.

## Zones géographiques couvertes
Toutes les villes, communes, quartiers, secteurs ou départements d'intervention cités, sur n'importe quelle page. Si rien n'est explicite, écris "À préciser".

## L'équipe
Un membre par ligne : Nom — rôle/fonction — spécialités, langues parlées, secteur, contact direct s'ils sont donnés. Si aucune information sur l'équipe, écris "À préciser".

## Biens disponibles
Un bloc par bien rencontré sur le site, avec TOUTES les caractéristiques trouvées, une par ligne :
- Référence / titre
- Type (maison, appartement, terrain, local commercial, immeuble…)
- Transaction (vente ou location) et prix (+ honoraires, charges, dépôt de garantie si mentionnés)
- Localisation (ville, quartier, secteur)
- Surface habitable et surface du terrain
- Nombre de pièces et de chambres
- Étage, présence d'ascenseur
- Équipements et prestations (garage, parking, cave, balcon, terrasse, jardin, piscine, cuisine équipée, type de chauffage, cheminée, climatisation…)
- Diagnostics (DPE, GES, classe énergie, année de construction)
- Description complète : résumé fidèle et détaillé du texte de l'annonce
Si aucun bien n'apparaît, écris "Aucun bien listé lors de l'analyse — à tenir à jour manuellement."

## Questions fréquentes (FAQ)
D'abord toutes les VRAIES questions/réponses trouvées sur le site, reprises fidèlement au format :
Q : …
R : …
Puis, sous un sous-titre "FAQ complémentaire probable", 3 à 6 questions qu'un visiteur poserait, avec une réponse courte et plausible fondée uniquement sur le contenu du site.

## Témoignages clients
Chaque témoignage ou avis publié sur le site, cité fidèlement, avec le nom ou l'initiale de l'auteur et la date si donnés. Si aucun, écris "Aucun témoignage publié sur le site."

## Coordonnées et informations pratiques
- Email :
- Téléphone :
- Adresse :
- Horaires d'ouverture :
- Réseaux sociaux :
- Carte professionnelle / SIRET / RCS :
Laisse "À préciser" pour chaque ligne absente du site.

## Autres informations utiles
Tout fait pertinent qui n'entre dans aucune autre section : partenaires, garanties, processus d'estimation ou de vente, frais d'agence, mandats, accessibilité, parking visiteurs, langues, actualités marquantes, etc.

Règles absolues : n'invente jamais un chiffre, un prix, un nom ou une adresse absents du contenu. Reste strictement factuel. Tout élément incertain ou manquant est marqué "À préciser". Le document peut être long : c'est voulu.`;

function orderOfKind(k: PageKind): number {
  return k === "accueil" ? 0 : k === "bien immobilier" ? 1 : 2;
}

function buildCorpus(pages: ScrapedPage[]): string {
  const sorted = [...pages].sort(
    (a, b) => orderOfKind(a.kind) - orderOfKind(b.kind)
  );

  const blocks: string[] = [];
  let used = 0;
  for (const p of sorted) {
    const header = `\n=== PAGE ${blocks.length + 1} — ${p.url} — « ${
      p.title || "sans titre"
    } » (${p.kind}) ===\n`;
    let body = p.text;
    const projected = used + header.length + body.length;
    if (projected > TOTAL_TEXT_BUDGET) {
      const room = TOTAL_TEXT_BUDGET - used - header.length;
      if (room < 600) break;
      body = `${body.slice(0, room)}\n[…contenu tronqué…]`;
    }
    blocks.push(header + body);
    used += header.length + body.length;
  }
  return blocks.join("\n");
}

/**
 * Demande au modèle la base de connaissances complète à partir de toutes les
 * pages explorées.
 */
export async function generateChatbotConfig(
  pages: ScrapedPage[],
  sourceUrl: string
): Promise<string> {
  if (!pages.length) {
    throw new Error("Aucune page exploitable n'a pu être récupérée.");
  }

  const anthropic = getAnthropic();
  const corpus = buildCorpus(pages);
  const propertyCount = pages.filter((p) => p.kind === "bien immobilier").length;

  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 3_500,
    system: KB_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Site analysé : ${sourceUrl}\n` +
          `Pages explorées : ${pages.length} (dont ${propertyCount} fiche(s) de bien).\n\n` +
          `Contenu brut, page par page :\n${corpus}`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Point d'entrée complet : explore le site puis produit sa base de
 * connaissances. Renvoie aussi la liste des pages visitées (pour l'UI).
 */
export async function analyzeSite(start: URL): Promise<{
  config: string;
  pages: { url: string; title: string; kind: PageKind }[];
  jsWarning: boolean;
}> {
  const { pages: scraped, jsWarning } = await crawlSite(start);
  if (!scraped.length) {
    throw new Error(
      jsWarning
        ? "Le site semble être une application JavaScript : aucun contenu exploitable n'a pu être extrait. Renseignez la base de connaissances manuellement."
        : "Impossible de récupérer le site : aucune page accessible."
    );
  }
  const config = await generateChatbotConfig(scraped, start.toString());
  return {
    config,
    pages: scraped.map((p) => ({ url: p.url, title: p.title, kind: p.kind })),
    jsWarning,
  };
}
