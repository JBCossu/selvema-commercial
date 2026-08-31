import { Resend } from "resend";

export function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Selvema <onboarding@resend.dev>";

export const APP_URL =
  process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3002";
