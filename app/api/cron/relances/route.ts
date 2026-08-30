import { NextResponse } from "next/server";
import { getDb, getConfig, isConfigReady } from "@/lib/db";
import type { Prospect } from "@/lib/db";
import { getResend, FROM_EMAIL } from "@/lib/resend";
import { followUpEmail, followUpNotice } from "@/lib/emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const config = await getConfig();
  if (!isConfigReady(config)) {
    return NextResponse.json({ skipped: "configuration incomplète" });
  }

  const sql = getDb();
  const resend = getResend();
  const sent: { step: 3 | 7; id: string }[] = [];

  // ── Relance J+3 ────────────────────────────────────────────────────────────
  const dueJ3 = (await sql`
    select * from prospects
    where kind = 'qualifie'
      and email is not null
      and followup_3_sent_at is null
      and status <> 'clos'
      and created_at <= now() - interval '3 days'
    order by created_at asc
    limit 25
  `) as Prospect[];

  for (const p of dueJ3) {
    const mail = followUpEmail(config, p, 3);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: p.email!,
      replyTo: config.owner_email,
      subject: mail.subject,
      html: mail.html,
    });
    const notice = followUpNotice(config, p, 3);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: config.owner_email,
      subject: notice.subject,
      html: notice.html,
    });
    await sql`
      update prospects
      set followup_3_sent_at = now(), last_followup_at = now(),
          status = case when status = 'nouveau' then 'relance_j3_envoyee' else status end
      where id = ${p.id}
    `;
    sent.push({ step: 3, id: p.id });
  }

  // ── Relance J+7 ────────────────────────────────────────────────────────────
  const dueJ7 = (await sql`
    select * from prospects
    where kind = 'qualifie'
      and email is not null
      and followup_3_sent_at is not null
      and followup_7_sent_at is null
      and status <> 'clos'
      and created_at <= now() - interval '7 days'
    order by created_at asc
    limit 25
  `) as Prospect[];

  for (const p of dueJ7) {
    const mail = followUpEmail(config, p, 7);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: p.email!,
      replyTo: config.owner_email,
      subject: mail.subject,
      html: mail.html,
    });
    const notice = followUpNotice(config, p, 7);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: config.owner_email,
      subject: notice.subject,
      html: notice.html,
    });
    await sql`
      update prospects
      set followup_7_sent_at = now(), last_followup_at = now(),
          status = 'relance_j7_envoyee'
      where id = ${p.id}
    `;
    sent.push({ step: 7, id: p.id });
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    j3_sent: sent.filter((s) => s.step === 3).length,
    j7_sent: sent.filter((s) => s.step === 7).length,
  });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
