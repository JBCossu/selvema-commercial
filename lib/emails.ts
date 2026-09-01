import type { Client, Lead } from "./db";
import { APP_URL } from "./resend";

export type MailClient = Pick<
  Client,
  "id" | "agency_name" | "owner_email" | "owner_phone"
>;

const WRAP = (inner: string) => `
<div style="background:#0b0b12;padding:32px 0;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#000;border:1px solid #882de1;border-radius:16px;padding:28px 30px;color:#fff;">
    <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#fff;margin-bottom:4px;">Selvema</div>
    ${inner}
    <p style="margin-top:28px;font-size:12px;color:#8b8b9a;">Assistant commercial Selvema · <a style="color:#c39bf0;" href="${APP_URL}/client/${"__CLIENT_ID__"}">Fiche client</a></p>
  </div>
</div>`;

function wrap(inner: string, clientId: string) {
  return WRAP(inner).replace("__CLIENT_ID__", clientId);
}

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

/** Relance J+3 / J+7 envoyée au prospect, au nom de l'agence. Ton chaleureux,
    aucun tiret. Deux réponses préécrites (mailto vers le dirigeant). */
export function followUpEmail(client: MailClient, p: Lead, step: 3 | 7) {
  const agency = escapeHtml(client.agency_name);
  const firstName = p.name ? p.name.split(" ")[0] : "";
  const hi = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";
  const par = (t: string) =>
    `<p style="color:#e6e6ef;font-size:14px;line-height:1.7;margin:0 0 14px;">${t}</p>`;
  const who = p.name ? `${p.name}` : "un prospect";
  const to = client.owner_email;

  let body: string;
  let subject: string;
  let buttons: string;

  if (step === 3) {
    subject = `Votre projet immobilier avec ${client.agency_name}`;
    buttons =
      replyButton(
        to,
        "Oui, appelez-moi",
        `Oui, appelez-moi (${who})`,
        `Bonjour,\n\nOui, je souhaite qu'un conseiller m'appelle pour parler de mon projet immobilier.\n\nMerci,\n${p.name || ""}`.trim(),
        true
      ) +
      replyButton(
        to,
        "Non merci",
        `Non merci (${who})`,
        `Bonjour,\n\nJe vous remercie mais je ne souhaite pas être recontacté pour le moment.\n\nBonne journée,\n${p.name || ""}`.trim(),
        false
      );
    body = `
      ${par(hi)}
      ${par(
        `Vous avez échangé récemment avec notre assistant en ligne au sujet de votre projet${
          p.project_type ? ` (${escapeHtml(p.project_type)})` : ""
        }. Je voulais simplement prendre de vos nouvelles.`
      )}
      ${par(
        `Souhaitez-vous qu'un conseiller vous appelle pour en discuter tranquillement de vive voix ? Un clic sur la réponse qui vous convient suffit.`
      )}
      <div style="margin:22px 0 6px;">${buttons}</div>
      ${par(
        `Vous pouvez aussi répondre directement à cet email, cela nous fait toujours plaisir de vous lire.`
      )}`;
  } else {
    subject = `On reste disponible pour votre projet, ${client.agency_name}`;
    buttons =
      replyButton(
        to,
        "Oui, recontactez-moi",
        `Oui, recontactez-moi (${who})`,
        `Bonjour,\n\nOui, vous pouvez me recontacter plus tard au sujet de mon projet immobilier.\n\nMerci,\n${p.name || ""}`.trim(),
        true
      ) +
      replyButton(
        to,
        "Non merci",
        `Non merci (${who})`,
        `Bonjour,\n\nJe vous remercie mais mon projet n'est plus d'actualité pour le moment.\n\nBonne journée,\n${p.name || ""}`.trim(),
        false
      );
    body = `
      ${par(hi)}
      ${par(
        `Je reviens vers vous une dernière fois au sujet de votre projet immobilier${
          p.location ? ` sur ${escapeHtml(p.location)}` : ""
        }. Si le moment n'est pas idéal pour vous, c'est tout à fait normal, et nous serons là le jour où vous serez prêt.`
      )}
      ${par(
        `Souhaitez-vous que l'on vous recontacte plus tard ? Un clic sur la réponse qui vous convient suffit.`
      )}
      <div style="margin:22px 0 6px;">${buttons}</div>
      ${par(
        `Quoi qu'il en soit, nous vous souhaitons une belle réussite dans votre projet.`
      )}`;
  }

  const inner = `
    <h1 style="font-size:19px;margin:12px 0 14px;color:#fff;">${agency}</h1>
    ${body}
    <p style="color:#e6e6ef;font-size:14px;line-height:1.7;margin-top:18px;">Bien à vous,<br/>L'équipe ${agency}${
      client.owner_phone ? `<br/>${escapeHtml(client.owner_phone)}` : ""
    }</p>`;
  return { subject, html: wrap(inner, client.id) };
}

/** Notification au dirigeant : une relance vient de partir. Aucun tiret. */
export function followUpNotice(client: MailClient, p: Lead, step: 3 | 7) {
  const inner = `
    <h1 style="font-size:19px;margin:12px 0 4px;color:#fff;">Relance J+${step} envoyée</h1>
    <p style="color:#c9c9d4;font-size:14px;margin:0 0 16px;">Une relance automatique vient de partir vers ce prospect au nom de ${escapeHtml(client.agency_name)}. L'email contient deux réponses préécrites : s'il en choisit une, sa réponse arrive directement dans votre boîte mail.</p>
    <table style="border-collapse:collapse;width:100%;">
      ${row("Nom", p.name)}
      ${row("Email", p.email)}
      ${row("Téléphone", p.phone)}
      ${row("Projet", p.project_type)}
      ${row("Prospect reçu le", new Date(p.created_at).toLocaleString("fr-FR"))}
    </table>`;
  return {
    subject: `Relance J+${step} envoyée${p.name ? " à " + p.name : ""}`,
    html: wrap(inner, client.id),
  };
}
