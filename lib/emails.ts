import type { AgencyConfig, Prospect } from "./db";
import { APP_URL } from "./resend";

const WRAP = (inner: string) => `
<div style="background:#0b0b12;padding:32px 0;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#000;border:1px solid #882de1;border-radius:16px;padding:28px 30px;color:#fff;">
    <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#fff;margin-bottom:4px;">Selvema</div>
    ${inner}
    <p style="margin-top:28px;font-size:12px;color:#8b8b9a;">Assistant commercial Selvema · <a style="color:#c39bf0;" href="${APP_URL}/dashboard">Tableau de bord</a></p>
  </div>
</div>`;

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

/** Fiche prospect qualifiée envoyée au dirigeant. */
export function prospectEmail(agency: AgencyConfig, p: Prospect) {
  const inner = `
    <h1 style="font-size:20px;margin:12px 0 4px;color:#fff;">Nouveau prospect qualifié</h1>
    <p style="color:#c9c9d4;font-size:14px;margin:0 0 18px;">Recueilli par l'assistant en ligne de ${escapeHtml(agency.agency_name)}.</p>
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
    html: WRAP(inner),
  };
}

/** Demande de rappel (question hors base de connaissances) envoyée au dirigeant. */
export function callbackEmail(agency: AgencyConfig, p: Prospect) {
  const inner = `
    <h1 style="font-size:20px;margin:12px 0 4px;color:#fff;">Demande de rappel</h1>
    <p style="color:#c9c9d4;font-size:14px;margin:0 0 18px;">Un visiteur de ${escapeHtml(agency.agency_name)} a une question qui sort du périmètre de l'assistant.</p>
    ${p.summary ? `<p style="background:#12121c;border-left:3px solid #882de1;padding:12px 14px;border-radius:8px;color:#e6e6ef;font-size:14px;margin:0 0 18px;">${escapeHtml(p.summary)}</p>` : ""}
    <table style="border-collapse:collapse;width:100%;">
      ${row("Nom", p.name)}
      ${row("Email", p.email)}
      ${row("Téléphone", p.phone)}
      ${row("Reçu le", new Date(p.created_at).toLocaleString("fr-FR"))}
    </table>`;
  return {
    subject: `Demande de rappel${p.name ? " — " + p.name : ""}`,
    html: WRAP(inner),
  };
}

/** Relance J+3 / J+7 envoyée au prospect, au nom de l'agence. */
export function followUpEmail(agency: AgencyConfig, p: Prospect, step: 3 | 7) {
  const hi = p.name ? `Bonjour ${escapeHtml(p.name.split(" ")[0])},` : "Bonjour,";
  const body =
    step === 3
      ? `<p style="color:#e6e6ef;font-size:14px;line-height:1.6;">${hi}</p>
         <p style="color:#e6e6ef;font-size:14px;line-height:1.6;">Vous avez récemment échangé avec notre assistant en ligne au sujet de votre projet${p.project_type ? " (" + escapeHtml(p.project_type) + ")" : ""}. Je voulais m'assurer que nous avons bien tous les éléments pour vous accompagner.</p>
         <p style="color:#e6e6ef;font-size:14px;line-height:1.6;">Souhaitez-vous qu'un conseiller vous appelle cette semaine ? Un simple retour à cet email suffit.</p>`
      : `<p style="color:#e6e6ef;font-size:14px;line-height:1.6;">${hi}</p>
         <p style="color:#e6e6ef;font-size:14px;line-height:1.6;">Je reviens vers vous une dernière fois concernant votre projet${p.location ? " sur " + escapeHtml(p.location) : ""}. Si le moment n'est pas idéal, aucun souci — dites-nous simplement quand vous recontacter.</p>
         <p style="color:#e6e6ef;font-size:14px;line-height:1.6;">Nous restons à votre disposition dès que vous le souhaitez.</p>`;
  const inner = `
    <h1 style="font-size:19px;margin:12px 0 12px;color:#fff;">${escapeHtml(agency.agency_name)}</h1>
    ${body}
    <p style="color:#e6e6ef;font-size:14px;line-height:1.6;margin-top:18px;">Bien à vous,<br/>L'équipe ${escapeHtml(agency.agency_name)}${agency.owner_phone ? "<br/>" + escapeHtml(agency.owner_phone) : ""}</p>`;
  return {
    subject:
      step === 3
        ? `Votre projet immobilier — ${agency.agency_name}`
        : `On reste disponible pour votre projet — ${agency.agency_name}`,
    html: WRAP(inner),
  };
}

/** Notification au dirigeant : une relance vient de partir. */
export function followUpNotice(agency: AgencyConfig, p: Prospect, step: 3 | 7) {
  const inner = `
    <h1 style="font-size:19px;margin:12px 0 4px;color:#fff;">Relance J+${step} envoyée</h1>
    <p style="color:#c9c9d4;font-size:14px;margin:0 0 16px;">Une relance automatique vient d'être envoyée à ce prospect au nom de ${escapeHtml(agency.agency_name)}.</p>
    <table style="border-collapse:collapse;width:100%;">
      ${row("Nom", p.name)}
      ${row("Email", p.email)}
      ${row("Téléphone", p.phone)}
      ${row("Projet", p.project_type)}
      ${row("Prospect créé le", new Date(p.created_at).toLocaleString("fr-FR"))}
    </table>`;
  return {
    subject: `Relance J+${step} envoyée${p.name ? " — " + p.name : ""}`,
    html: WRAP(inner),
  };
}
