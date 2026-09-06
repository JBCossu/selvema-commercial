import type { Client, Lead } from "./db";
import { APP_URL } from "./resend";
import { SCORE_META } from "./score-meta";

export type MailClient = Pick<
  Client,
  "id" | "agency_name" | "owner_email" | "owner_phone"
>;

const SHELL = (inner: string, footer: string) => `
<div style="background:#0b0b12;padding:32px 0;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#000;border:1px solid #882de1;border-radius:16px;padding:28px 30px;color:#fff;">
    <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#fff;margin-bottom:4px;">Selvema</div>
    ${inner}
    ${footer}
  </div>
</div>`;

/**
 * Enveloppe visuelle commune. `footer` est affiché par défaut (lien « Fiche
 * client » vers le back office, utile au dirigeant) mais est retiré pour les
 * emails envoyés au prospect, qui n'ont rien à voir avec le back office.
 */
function wrap(inner: string, clientId: string, opts: { footer?: boolean } = {}) {
  const footer =
    opts.footer === false
      ? ""
      : `<p style="margin-top:28px;font-size:12px;color:#8b8b9a;">Assistant commercial Selvema · <a style="color:#c39bf0;" href="${APP_URL}/client/${clientId}">Fiche client</a></p>`;
  return SHELL(inner, footer);
}

/** Petit intitulé de section, en gris. */
const kicker = (t: string) =>
  `<p style="margin:22px 0 10px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8b8b9a;">${t}</p>`;

const row = (label: string, value: string | null | undefined) =>
  value && String(value).trim()
    ? `<tr>
        <td style="padding:6px 12px 6px 0;color:#8b8b9a;font-size:13px;vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:6px 0;color:#fff;font-size:13px;">${escapeHtml(String(value))}</td>
      </tr>`
    : "";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bloc « Score commercial » pour la fiche prospect. */
function scoreBlock(p: Lead): string {
  if (typeof p.score !== "number" || !p.score_category) return "";
  const m = SCORE_META[p.score_category];
  const b = p.score_breakdown;
  const lines = b
    ? (
        [
          b.budget_coherent,
          b.zone_couverte,
          b.projet_clair,
          b.delai_court,
          b.intention_forte,
        ] as { label: string; ok: boolean; points: number }[]
      )
        .map(
          (c) =>
            `<tr>
              <td style="padding:3px 10px 3px 0;font-size:12px;color:${c.ok ? "#e6e6ef" : "#6b6b7a"};">${c.ok ? "✓" : "·"} ${escapeHtml(c.label)}</td>
              <td style="padding:3px 0;font-size:12px;text-align:right;color:${c.ok ? "#e6e6ef" : "#6b6b7a"};white-space:nowrap;">+${c.points}</td>
            </tr>`
        )
        .join("")
    : "";
  const horsCriteres = b?.hors_criteres
    ? `<p style="margin:8px 0 0;font-size:12px;font-weight:700;color:${SCORE_META.faible.color};">Hors critères de qualification de l'agence${b.motif_hors_criteres ? ` : ${escapeHtml(b.motif_hors_criteres)}` : ""}</p>`
    : "";
  return `
    <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#12121c;border:1px solid ${m.color}55;">
      <div style="font-size:16px;font-weight:700;color:${m.color};">${m.emoji} Score ${p.score}/100 · ${m.label}</div>
      ${horsCriteres}
      ${b?.analyse ? `<p style="margin:8px 0 0;font-size:13px;color:#c9c9d4;line-height:1.5;">${escapeHtml(b.analyse)}</p>` : ""}
      ${lines ? `<table style="border-collapse:collapse;width:100%;margin-top:10px;">${lines}</table>` : ""}
    </div>`;
}

/** Fiche prospect qualifiée envoyée au dirigeant du client. */
export function prospectEmail(client: MailClient, p: Lead) {
  const inner = `
    <h1 style="font-size:20px;margin:12px 0 4px;color:#fff;">Nouveau prospect qualifié</h1>
    <p style="color:#c9c9d4;font-size:14px;margin:0 0 18px;">Recueilli par l'assistant en ligne de ${escapeHtml(client.agency_name)}.</p>
    ${scoreBlock(p)}
    ${p.summary ? `<p style="background:#12121c;border-left:3px solid #882de1;padding:12px 14px;border-radius:8px;color:#e6e6ef;font-size:14px;margin:0 0 18px;">${escapeHtml(p.summary)}</p>` : ""}
    <table style="border-collapse:collapse;width:100%;">
      ${row("Projet", p.project_type)}
      ${row("Budget", p.budget)}
      ${row("Type de bien", p.property_type)}
      ${row("Localisation", p.location)}
      ${row("Délai", p.timeline)}
      ${row("Situation", p.situation)}
      <tr><td colspan="2" style="padding:10px 0;"><hr style="border:none;border-top:1px solid #24243a;" /></td></tr>
      ${row("Nom", p.name)}
      ${row("Email", p.email)}
      ${row("Téléphone", p.phone)}
      ${row("Reçu le", new Date(p.created_at).toLocaleString("fr-FR"))}
    </table>`;
  return {
    subject: `Nouveau prospect${p.name ? " — " + p.name : ""}${p.project_type ? " (" + p.project_type + ")" : ""}`,
    html: wrap(inner, client.id),
  };
}

/** Demande de rappel (question hors base de connaissances) envoyée au dirigeant. */
export function callbackEmail(client: MailClient, p: Lead) {
  const inner = `
    <h1 style="font-size:20px;margin:12px 0 4px;color:#fff;">Demande de rappel</h1>
    <p style="color:#c9c9d4;font-size:14px;margin:0 0 18px;">Un visiteur de ${escapeHtml(client.agency_name)} a une question qui sort du périmètre de l'assistant.</p>
    ${p.summary ? `<p style="background:#12121c;border-left:3px solid #882de1;padding:12px 14px;border-radius:8px;color:#e6e6ef;font-size:14px;margin:0 0 18px;">${escapeHtml(p.summary)}</p>` : ""}
    <table style="border-collapse:collapse;width:100%;">
      ${row("Nom", p.name)}
      ${row("Email", p.email)}
      ${row("Téléphone", p.phone)}
      ${row("Reçu le", new Date(p.created_at).toLocaleString("fr-FR"))}
    </table>`;
  return {
    subject: `Demande de rappel${p.name ? " — " + p.name : ""}`,
    html: wrap(inner, client.id),
  };
}

/**
 * Deux « réponses préécrites » : de simples liens mailto vers l'adresse du
 * dirigeant, avec objet + corps déjà rédigés. Le prospect clique, sa messagerie
 * ouvre une réponse toute prête adressée à l'agence, il n'a plus qu'à l'envoyer.
 * Aucun jeton, aucune page web : la réponse arrive directement dans la boîte du
 * dirigeant. (Gmail affiche aussi ses suggestions de réponse rapide par-dessus.)
 */
function replyButton(
  to: string,
  label: string,
  subject: string,
  body: string,
  primary: boolean
): string {
  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
  const base =
    "display:inline-block;padding:12px 22px;border-radius:9999px;font-size:14px;font-weight:600;text-decoration:none;margin:0 10px 10px 0;";
  const skin = primary
    ? "background:#882de1;color:#ffffff;"
    : "background:#15151f;color:#c9c9d4;border:1px solid #33334a;";
  return `<a href="${href}" style="${base}${skin}">${label}</a>`;
}

/**
 * Relance J+3 / J+7 envoyée au prospect, au nom de l'agence cliente.
 * Expéditeur et objet = nom de l'agence. Ton humain et chaleureux, aucun tiret
 * dans le texte visible (seul « Oui, appelez-moi » garde le sien : c'est le
 * libellé du bouton, dicté tel quel).
 *
 *   corps J+3   → rappelle l'échange avec l'agent commercial, propose l'appel
 *   corps J+7   → dernière relance, plus douce, compréhensive
 *   2 boutons   → liens mailto vers le dirigeant, réponse déjà rédigée
 *   signature   → « Cordialement, l'Agence X » + numéro + email de l'agence
 */
export function followUpEmail(client: MailClient, p: Lead, step: 3 | 7) {
  const agency = escapeHtml(client.agency_name);
  const firstName = p.name ? p.name.split(" ")[0] : "";
  const hi = firstName ? `Bonjour ${escapeHtml(firstName)}.` : "Bonjour.";
  const to = client.owner_email;

  let paragraphs: string[];
  let yesBody: string;
  let noBody: string;

  if (step === 3) {
    yesBody = `Bonjour, oui je souhaite qu'un conseiller m'appelle.\n\nMerci,\n${firstName}`.trim();
    noBody = `Bonjour, je vous remercie mais je ne souhaite pas être contacté pour le moment.\n\nBonne journée,\n${firstName}`.trim();
    paragraphs = [
      hi,
      `Vous avez échangé récemment avec notre agent commercial sur notre site internet, je voulais simplement savoir si vous vouliez en discuter plus sérieusement avec un conseiller. Vous n'avez qu'à cliquer sur "Oui, appelez-moi" puis sur Envoyer, et nous vous recontacterons au plus vite.`,
    ];
  } else {
    yesBody = `Bonjour, oui je souhaite finalement qu'un conseiller m'appelle.\n\nMerci,\n${firstName}`.trim();
    noBody = `Bonjour, je vous remercie mais je ne souhaite définitivement pas être contacté.\n\nBonne journée,\n${firstName}`.trim();
    paragraphs = [
      hi,
      `Je reviens vers vous une dernière fois au sujet de votre conversation avec notre agent commercial sur notre site internet. Si le moment n'est pas idéal pour vous, c'est tout à fait compréhensible et nous serons là le jour où vous serez prêt.`,
      `Un clic sur "Oui, appelez-moi" suffit pour que l'on vous recontacte plus tard si jamais vous souhaitez finalement en discuter avec un conseiller.`,
      `Quoi qu'il en soit, nous vous souhaitons une belle réussite dans votre projet immobilier.`,
    ];
  }

  const buttons =
    replyButton(to, "Oui, appelez-moi", "Réponse prospect", yesBody, true) +
    " " +
    replyButton(to, "Non merci", "Réponse prospect", noBody, false);

  const phoneLine = client.owner_phone
    ? `${escapeHtml(client.owner_phone)}<br/>`
    : "";
  const br2 = "<br/><br/>";

  // Structure la plus sûre pour Gmail : UNE seule table, UN seul <tr><td>.
  // Tout le contenu (en-tête, corps, boutons, signature) vit dans la même
  // cellule, séparé uniquement par des <br/>. Aucun div ni table imbriqués,
  // aucune balise de bloc interne — rien que Gmail puisse isoler et replier
  // derrière les « ••• ».
  const html =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="max-width:560px;margin:0 auto;background:#000000;border:1px solid #882de1;border-radius:16px;font-family:Inter,Segoe UI,Arial,sans-serif;">` +
    `<tr><td style="padding:28px 30px;color:#e6e6ef;font-size:14px;line-height:1.7;">` +
    `<span style="font-size:18px;font-weight:700;color:#ffffff;">Selvema</span>` +
    br2 +
    `<span style="font-size:19px;font-weight:700;color:#ffffff;">${agency}</span>` +
    br2 +
    paragraphs.join(br2) +
    br2 +
    buttons +
    `<br/>Cordialement,<br/>L'Agence ${agency}<br/>${phoneLine}${escapeHtml(
      client.owner_email
    )}` +
    `</td></tr></table>`;

  // Objet distinct pour le J+7 : Gmail ne le regroupe pas dans le même fil que
  // le J+3 et ne replie donc pas le contenu commun derrière les « ••• ».
  const subject =
    step === 7
      ? `${client.agency_name} — Dernière relance`
      : client.agency_name;

  return { subject, html };
}

/** Contexte complet de l'échange, pour que le dirigeant comprenne la situation
    en un coup d'oeil. Le résumé de l'assistant d'abord, puis les faits connus. */
function leadContext(p: Lead): string {
  const parts: string[] = [];
  if (p.summary && p.summary.trim()) parts.push(p.summary.trim());
  const facts: string[] = [];
  if (p.project_type) facts.push(`Projet : ${p.project_type}`);
  if (p.property_type) facts.push(`Type de bien : ${p.property_type}`);
  if (p.location) facts.push(`Secteur : ${p.location}`);
  if (p.budget) facts.push(`Budget : ${p.budget}`);
  if (p.timeline) facts.push(`Échéance : ${p.timeline}`);
  if (p.situation) facts.push(`Situation : ${p.situation}`);
  if (facts.length) parts.push(facts.join(" · "));
  return parts.join("\n\n") || "Le contexte de l'échange n'a pas été précisé.";
}

/**
 * Notification au dirigeant : une relance J+3 ou J+7 vient d'être envoyée au
 * prospect, au nom de son agence. Objet « Relance J+X envoyée », annonce, puis
 * Nom / Numéro / Courriel / Contexte de l'échange. Aucun tiret.
 */
export function followUpNotice(client: MailClient, p: Lead, step: 3 | 7) {
  const contextHtml = escapeHtml(leadContext(p)).replace(/\n/g, "<br/>");
  const inner = `
    <h1 style="font-size:19px;margin:12px 0 8px;color:#fff;">Relance J+${step} envoyée</h1>
    <p style="color:#c9c9d4;font-size:14px;line-height:1.7;margin:0 0 8px;">
      Une relance automatique vient d'être envoyée vers ce prospect au nom de ${escapeHtml(
        client.agency_name
      )}. Le message contient deux choix de réponse précis. En cas d'action de sa part, vous serez averti directement dans votre boite mail.
    </p>
    ${kicker("Informations sur le prospect")}
    <table style="border-collapse:collapse;width:100%;">
      ${row("Nom", p.name)}
      ${row("Numéro", p.phone)}
      ${row("Courriel", p.email)}
      <tr>
        <td style="padding:6px 12px 6px 0;color:#8b8b9a;font-size:13px;vertical-align:top;white-space:nowrap;">Contexte</td>
        <td style="padding:6px 0;color:#fff;font-size:13px;line-height:1.6;">${contextHtml}</td>
      </tr>
    </table>`;
  return {
    subject: `Relance J+${step} envoyée`,
    html: wrap(inner, client.id),
  };
}

/* ------------------------------------------------------------------ *
 *  Rapport mensuel automatique (cron du 1er du mois)
 * ------------------------------------------------------------------ */

export type MonthlyStats = {
  /** Conversations démarrées par des visiteurs sur le mois écoulé. */
  conversations: number;
  /** Leads qualifiés générés (prospects ayant laissé leurs coordonnées). */
  qualifiedLeads: number;
  /** Relances J+3 parties sur le mois. */
  followup3: number;
  /** Relances J+7 parties sur le mois. */
  followup7: number;
  /** Détail des leads qualifiés du mois. */
  leads: Array<{
    name: string | null;
    email: string | null;
    phone: string | null;
    summary: string | null;
  }>;
};

/**
 * Bilan mensuel de l'assistant commercial.
 *  - `forSelvema: false` → email au dirigeant de l'agence.
 *  - `forSelvema: true`  → copie interne pour Jean Baptiste, avec l'agence et le
 *    dirigeant rappelés en en-tête et un objet distinct (un email par client).
 */
export function monthlyReportEmail(
  client: MailClient,
  stats: MonthlyStats,
  monthLabel: string,
  opts: { forSelvema: boolean }
) {
  const agency = escapeHtml(client.agency_name);

  const metric = (label: string, n: number) => `<tr>
      <td style="padding:7px 14px 7px 0;color:#c9c9d4;font-size:14px;">${label}</td>
      <td style="padding:7px 0;color:#fff;font-size:16px;font-weight:700;text-align:right;white-space:nowrap;">${n}</td>
    </tr>`;

  const leadCard = (l: MonthlyStats["leads"][number]) => {
    const contact = [l.email, l.phone].filter((v) => v && String(v).trim());
    return `<div style="background:#12121c;border:1px solid #24243a;border-radius:10px;padding:12px 14px;margin:0 0 10px;">
      <div style="color:#fff;font-size:14px;font-weight:700;margin-bottom:2px;">${escapeHtml(l.name || "Sans nom")}</div>
      ${
        contact.length
          ? `<div style="color:#c39bf0;font-size:13px;margin-bottom:6px;">${contact
              .map((c) => escapeHtml(String(c)))
              .join(" &middot; ")}</div>`
          : ""
      }
      <div style="color:#c9c9d4;font-size:13px;line-height:1.6;">${escapeHtml(
        l.summary || "Pas de résumé."
      )}</div>
    </div>`;
  };

  const leadsBlock = stats.leads.length
    ? stats.leads.map(leadCard).join("")
    : `<p style="color:#8b8b9a;font-size:13px;">Aucun lead qualifié ce mois.</p>`;

  const internalHeader = opts.forSelvema
    ? `<p style="background:#12121c;border-left:3px solid #882de1;padding:10px 14px;border-radius:8px;color:#e6e6ef;font-size:13px;line-height:1.7;margin:0 0 18px;">
         Agence : ${agency}<br/>
         Dirigeant : ${escapeHtml(client.owner_email)}${
        client.owner_phone ? ` &middot; ${escapeHtml(client.owner_phone)}` : ""
      }
       </p>`
    : "";

  const inner = `
    <h1 style="font-size:20px;margin:12px 0 4px;color:#fff;">Bilan mensuel${
      opts.forSelvema ? ` &mdash; ${agency}` : ""
    }</h1>
    <p style="color:#8b8b9a;font-size:13px;margin:0 0 18px;">Mois écoulé : ${escapeHtml(
      monthLabel
    )}</p>
    ${internalHeader}
    <p style="color:#e6e6ef;font-size:14px;line-height:1.7;margin:0 0 16px;">Bonjour, voici le bilan de votre assistant commercial pour le mois écoulé.</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 8px;">
      ${metric("Conversations démarrées par des visiteurs", stats.conversations)}
      ${metric("Leads qualifiés générés (coordonnées laissées)", stats.qualifiedLeads)}
      ${metric("Relances J+3 envoyées", stats.followup3)}
      ${metric("Relances J+7 envoyées", stats.followup7)}
    </table>
    ${kicker("Leads générés ce mois")}
    ${leadsBlock}
    <p style="color:#e6e6ef;font-size:14px;line-height:1.7;margin:24px 0 0;">
      Cordialement,<br/>
      Jean Baptiste Cossu &mdash; Selvema<br/>
      jean.baptiste@selvema.com &mdash; 06 41 43 34 94
    </p>`;

  const subject = opts.forSelvema
    ? `Bilan mensuel — ${client.agency_name} — ${monthLabel}`
    : `Votre bilan mensuel — ${client.agency_name}`;

  return { subject, html: wrap(inner, client.id) };
}
