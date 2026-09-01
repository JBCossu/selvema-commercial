import { Resend } from "resend";

export function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Selvema <onboarding@resend.dev>";

/**
 * Reprend l'adresse d'envoi vérifiée mais change le nom affiché de
 * l'expéditeur. Sert pour les relances au prospect, qui partent au nom de
 * l'agence cliente et non de Selvema.
 */
export function fromWithName(displayName: string): string {
  const match = FROM_EMAIL.match(/<([^>]+)>/);
  const address = (match ? match[1] : FROM_EMAIL).trim();
  const name = displayName.replace(/["<>]/g, "").trim() || "Selvema";
  return `${name} <${address}>`;
}

export const APP_URL =
  process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3002";
