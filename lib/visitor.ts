import { getDb } from "./db";

/**
 * Mémoire visiteur : un visiteur qui revient est reconnu grâce à un UUID anonyme
 * (`selvema_visitor_id`, généré par widget.js dans le localStorage du navigateur,
 * transmis à l'iframe puis à /api/chat). Aucune donnée personnelle n'est stockée
 * côté client, seulement cet identifiant.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

export type VisitorMemory = {
  lastSeen: string;
  summary: string | null;
  projectType: string | null;
  budget: string | null;
  propertyType: string | null;
  location: string | null;
  timeline: string | null;
};

/**
 * Renvoie ce que l'on sait de la précédente visite de ce visiteur chez ce
 * client, ou null s'il n'a jamais eu de conversation. On privilégie une
 * conversation qui a débouché sur une fiche prospect (résumé + critères),
 * sinon la plus récente.
 */
export async function getVisitorMemory(
  clientId: string,
  visitorId: string
): Promise<VisitorMemory | null> {
  if (!clientId || !isVisitorId(visitorId)) return null;
  const sql = getDb();
  const rows = (await sql`
    select
      c.created_at, c.updated_at,
      l.summary, l.project_type, l.budget, l.property_type, l.location, l.timeline
    from conversations c
    left join leads l
      on l.conversation_id = c.id and l.kind = 'qualifie'
    where c.client_id = ${clientId} and c.visitor_id = ${visitorId}
    order by (l.summary is not null) desc, c.created_at desc
    limit 1
  `) as Record<string, string | null>[];

  const r = rows[0];
  if (!r) return null;
  return {
    lastSeen: r.updated_at || r.created_at || "",
    summary: r.summary,
    projectType: r.project_type,
    budget: r.budget,
    propertyType: r.property_type,
    location: r.location,
    timeline: r.timeline,
  };
}

/** Phrase courte « vous cherchiez à acheter à Lyon 6e ». */
function projectPhrase(m: VisitorMemory): string | null {
  const loc = m.location ? ` sur ${m.location}` : "";
  switch ((m.projectType || "").toLowerCase()) {
    case "achat":
      return `cherchiez à acheter${loc}`;
    case "vente":
      return `souhaitiez vendre${loc ? " un bien" + loc : ""}`;
    case "location":
      return `cherchiez une location${loc}`;
    case "investissement":
      return `prépariez un investissement locatif${loc}`;
  }
  return null;
}

/** Message d'accueil « bulle » pour un visiteur reconnu (affiché par ChatWidget). */
export function returningGreeting(m: VisitorMemory): string {
  const p = projectPhrase(m);
  return p
    ? `Bonjour, content de vous revoir ! La dernière fois, vous ${p}. Où en êtes-vous ?`
    : `Bonjour, content de vous revoir ! Comment puis-je vous aider aujourd'hui ?`;
}

/** Section à injecter dans le prompt système quand le visiteur est reconnu. */
export function visitorMemoryPrompt(m: VisitorMemory): string {
  const lines: string[] = [];
  if (m.summary) lines.push(`Résumé de sa dernière visite : ${m.summary}`);
  if (m.projectType) lines.push(`Type de projet : ${m.projectType}`);
  if (m.budget) lines.push(`Budget évoqué : ${m.budget}`);
  if (m.propertyType) lines.push(`Type de bien : ${m.propertyType}`);
  if (m.location) lines.push(`Localisation : ${m.location}`);
  if (m.timeline) lines.push(`Délai évoqué : ${m.timeline}`);
  if (m.lastSeen) {
    try {
      lines.push(
        `Dernière visite : ${new Date(m.lastSeen).toLocaleDateString("fr-FR")}`
      );
    } catch {
      /* ignore */
    }
  }
  const known = lines.length
    ? lines.map((l) => `- ${l}`).join("\n")
    : "- (aucun détail enregistré sur son projet précédent)";

  return `# VISITEUR DÉJÀ VENU
Ce visiteur a déjà échangé avec toi lors d'une visite précédente. Ce que tu sais de lui :
${known}

Comportement attendu :
- Accueille-le comme quelqu'un que tu reconnais, chaleureusement (« Bonjour, content de vous revoir ! »). Rappelle brièvement son projet s'il est connu et demande où il en est.
- Ne repose PAS les questions de qualification auxquelles il a déjà répondu (celles dont tu connais la réponse ci-dessus).
- Reprends la conversation là où elle s'était arrêtée : concentre-toi sur ce qui manque ou ce qui a évolué.
- S'il revient avec un projet totalement différent, traite-le comme une nouvelle demande, sans t'accrocher à l'ancien.`;
}
