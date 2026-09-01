import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Lead } from "@/lib/db";
import { getResend, FROM_EMAIL, fromWithName } from "@/lib/resend";
import { followUpEmail, followUpNotice, type MailClient } from "@/lib/emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type JoinedLead = Lead & {
  c_id: string;
  agency_name: string;
  owner_email: string;
  owner_phone: string;
};

function mailClient(r: JoinedLead): MailClient {
  return {
    id: r.c_id,
    agency_name: r.agency_name,
    owner_email: r.owner_email,
    owner_phone: r.owner_phone,
  };
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const sql = getDb();
  const resend = getResend();
  const sent: { step: 3 | 7; lead: string }[] = [];

  const dueJ3 = (await sql`
    select l.*, c.id as c_id, c.agency_name, c.owner_email, c.owner_phone
    from leads l
    join clients c on c.id = l.client_id
    where c.active = true
      and l.kind = 'qualifie'
      and l.email is not null
      and l.followup_3_sent_at is null
      and l.status <> 'clos'
      and l.created_at <= now() - interval '3 days'
    order by l.created_at asc
    limit 50
  `) as JoinedLead[];

  for (const r of dueJ3) {
    const client = mailClient(r);
    const mail = followUpEmail(client, r, 3);
    await resend.emails.send({
      from: fromWithName(client.agency_name),
      to: r.email!,
      replyTo: client.owner_email,
      subject: mail.subject,
      html: mail.html,
    });
    const notice = followUpNotice(client, r, 3);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: client.owner_email,
      subject: notice.subject,
      html: notice.html,
    });
    await sql`
      update leads
      set followup_3_sent_at = now(), last_followup_at = now(),
          status = case when status = 'nouveau' then 'relance_j3_envoyee' else status end
      where id = ${r.id}
    `;
    sent.push({ step: 3, lead: r.id });
  }

  const dueJ7 = (await sql`
    select l.*, c.id as c_id, c.agency_name, c.owner_email, c.owner_phone
    from leads l
    join clients c on c.id = l.client_id
    where c.active = true
      and l.kind = 'qualifie'
      and l.email is not null
      and l.followup_3_sent_at is not null
      and l.followup_7_sent_at is null
      and l.status <> 'clos'
      and l.created_at <= now() - interval '7 days'
    order by l.created_at asc
    limit 50
  `) as JoinedLead[];

  for (const r of dueJ7) {
    const client = mailClient(r);
    const mail = followUpEmail(client, r, 7);
    await resend.emails.send({
      from: fromWithName(client.agency_name),
      to: r.email!,
      replyTo: client.owner_email,
      subject: mail.subject,
      html: mail.html,
    });
    const notice = followUpNotice(client, r, 7);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: client.owner_email,
      subject: notice.subject,
      html: notice.html,
    });
    await sql`
      update leads
      set followup_7_sent_at = now(), last_followup_at = now(),
          status = 'relance_j7_envoyee'
      where id = ${r.id}
    `;
    sent.push({ step: 7, lead: r.id });
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
