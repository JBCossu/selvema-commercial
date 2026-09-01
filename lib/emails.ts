import type { Client, Lead } from "./db";
import { APP_URL } from "./resend";

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

/** Fiche prospect qualifiée envoyée au dirigeant du client. */
export function prospectEmail(client: MailClient, p: Lead) {
  const inner = `
    <h1 style="font-size:20px;margin:12px 0 4px;color:#fff;">Nouveau prospect qualifié</h1>
    <p style="color:#c9c9d4;font-size:14px;margin:0 0 18px;">Recueilli par l'assistant en ligne de ${escapeHtml(client.agency_name)}.</p>
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
 *
 * Structure reprise du document de référence :
 *   en tête du corps  → le nom de l'agence
 *   corps J+3         → message chaleureux qui rappelle l'échange avec
 *                       l'assistant et propose un appel avec un conseiller
 *   corps J+7         → message plus doux, dernière tentative, compréhensif si
 *                       le moment n'est pas idéal
 *   choix de réponse  → deux boutons mailto « Oui, appelez-moi » / « Non merci »
 *   signature         → nom de l'agence + numéro + email du dirigeant
 *
 * Les deux boutons sont de simples liens mailto vers l'adresse du dirigeant,
 * avec objet et corps déjà rédigés (repris mot pour mot du document). Le
 * prospect clique, sa messagerie ouvre une réponse toute prête adressée à
 * l'agence, il n'a plus qu'à l'envoyer : elle arrive directement dans la boîte
 * du dirigeant, sans page web ni jeton. Aucun tiret dans le texte visible.
 */
export function followUpEmail(client: MailClient, p: Lead, step: 3 | 7) {
  const agency = escapeHtml(client.agency_name);
  const firstName = p.name ? p.name.split(" ")[0] : "";
  const hi = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";
  const signName = firstName || p.name || "";
  const who = p.name || "un prospect";
  const to = client.owner_email;
  const par = (t: string) =>
    `<p style="color:#e6e6ef;font-size:14px;line-height:1.7;margin:0 0 14px;">${t}</p>`;

  let subject: string;
  let body: string;
  let yesBody: string;
  let noBody: string;

  if (step === 3) {
    subject = `Votre projet immobilier avec ${client.agency_name}`;
    yesBody = `Bonjour,\n\nOui, je souhaite qu'un conseiller m'appelle.\n\nMerci,\n${signName}`.trim();
    noBody = `Bonjour,\n\nJe vous remercie, mais je ne souhaite pas être contacté pour le moment.\n\nBonne journée,\n${signName}`.trim();
    body = `
      ${par(hi)}
      ${par(
        `Vous avez échangé récemment avec notre assistant en ligne sur notre site internet au sujet de votre projet${
          p.project_type ? ` (${escapeHtml(p.project_type)})` : ""
        }. Je voulais simplement savoir si vous souhaitiez en parler plus sérieusement avec un conseiller.`
      )}
      ${par(
        `Un clic sur la réponse qui vous convient suffit, puis vous validez par Envoyer et nous revenons vers vous au plus vite.`
      )}`;
  } else {
    subject = `On reste disponible pour votre projet, ${client.agency_name}`;
    yesBody = `Bonjour,\n\nOui, je souhaite finalement qu'un conseiller m'appelle.\n\nMerci,\n${signName}`.trim();
    noBody = `Bonjour,\n\nJe vous remercie, mais je ne souhaite définitivement pas être contacté.\n\nBonne journée,\n${signName}`.trim();
    body = `
      ${par(hi)}
      ${par(
        `Je reviens vers vous une dernière fois au sujet de votre conversation avec notre assistant en ligne sur notre site internet.`
      )}
      ${par(
        `Si le moment n'est pas idéal pour vous, c'est tout à fait compréhensible, et nous serons là le jour où vous serez prêt.`
      )}
      ${par(
        `Un clic suffit pour que l'on vous recontacte plus tard, si vous souhaitez finalement en discuter avec un conseiller.`
      )}`;
  }

  const buttons =
    replyButton(to, "Oui, appelez-moi", `Oui, appelez-moi (${who})`, yesBody, true) +
    replyButton(to, "Non merci", `Non merci (${who})`, noBody, false);

  const closing =
    step === 3
      ? `Vous pouvez aussi répondre directement à cet email, cela nous fera plaisir de vous lire.`
      : `Quoi qu'il en soit, nous vous souhaitons une belle réussite dans votre projet immobilier.`;

  const phoneLine = client.owner_phone
    ? `${escapeHtml(client.owner_phone)}<br/>`
    : "";
  const signature = `
    <p style="color:#e6e6ef;font-size:14px;line-height:1.7;margin:24px 0 0;">
      Bien à vous,<br/>
      ${agency}<br/>
      <span style="color:#8b8b9a;">Coordonnées de l'agence :</span><br/>
      ${phoneLine}${escapeHtml(client.owner_email)}
    </p>`;

  const inner = `
    <h1 style="font-size:19px;margin:12px 0 14px;color:#fff;">${agency}</h1>
    ${body}
    ${kicker("Choix de réponse")}
    <div style="margin:0 0 6px;">${buttons}</div>
    ${par(closing)}
    ${signature}`;

  return { subject, html: wrap(inner, client.id, { footer: false }) };
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
 * Notification au dirigeant : une relance J+3 ou J+7 vient de partir vers son
 * prospect, au nom de son agence. Structure reprise du document de référence :
 * titre « Relance J+X envoyée », annonce, puis les informations du prospect
 * (Nom, Numéro, Courriel, Contexte). Aucun tiret dans le texte visible.
 */
export function followUpNotice(client: MailClient, p: Lead, step: 3 | 7) {
  const contextHtml = escapeHtml(leadContext(p)).replace(/\n/g, "<br/>");
  const inner = `
    <h1 style="font-size:19px;margin:12px 0 8px;color:#fff;">Relance J+${step} envoyée</h1>
    <p style="color:#c9c9d4;font-size:14px;line-height:1.7;margin:0 0 8px;">
      Une relance automatique vient de partir vers ce prospect au nom de ${escapeHtml(
        client.agency_name
      )}. Le message contient deux choix de réponse très clairs. Si le prospect réagit, vous êtes averti directement dans votre boîte mail.
    </p>
    ${kicker("Informations concernant le prospect")}
    <table style="border-collapse:collapse;width:100%;">
      ${row("Nom", p.name)}
      ${row("Numéro", p.phone)}
      ${row("Courriel", p.email)}
      <tr>
        <td style="padding:6px 12px 6px 0;color:#8b8b9a;font-size:13px;vertical-align:top;white-space:nowrap;">Contexte</td>
        <td style="padding:6px 0;color:#fff;font-size:13px;line-height:1.6;">${contextHtml}</td>
      </tr>
    </table>
    <p style="color:#8b8b9a;font-size:13px;line-height:1.7;margin:16px 0 0;">
      L'objectif est que vous ayez assez de contexte pour comprendre rapidement la situation et savoir quoi dire si vous rappelez le prospect.
    </p>`;
  return {
    subject: `Relance J+${step} envoyée`,
    html: wrap(inner, client.id),
  };
}
