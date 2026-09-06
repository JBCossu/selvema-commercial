import { NextResponse } from "next/server";
import { getDb, listActiveClients } from "@/lib/db";
import { getResend, FROM_EMAIL } from "@/lib/resend";
import {
  monthlyReportEmail,
  type MailClient,
  type MonthlyStats,
} from "@/lib/emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JB_EMAIL = "jean.baptiste@selvema.com";
const CLIENT_DELAY_MS = 250; // petite pause entre clients (ménage Resend)
const HARD_BUDGET_MS = 55_000; // marge avant coupure de la fonction

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

type CountRow = { client_id: string; n: number };
type LeadRow = {
  client_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  summary: string | null;
};
type Outcome = {
  id: string;
  agency_name: string;
  status: "sent" | "skipped" | "error";
  conversations?: number;
  qualifiedLeads?: number;
  followup3?: number;
  followup7?: number;
  reason?: string;
};

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY non configurée." },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  // Mois écoulé = le mois calendaire qui vient de se terminer (le cron tourne
  // le 1er). Bornes calculées en UTC, gestion du passage d'année incluse.
  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();
  const monthLabel = periodStart.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const sql = getDb();
  const resend = getResend();

  let clients: Awaited<ReturnType<typeof listActiveClients>>;
  let convRows: CountRow[];
  let leadRows: LeadRow[];
  let f3Rows: CountRow[];
  let f7Rows: CountRow[];
  try {
    clients = await listActiveClients();
    convRows = (await sql`
      select client_id, count(*)::int as n
      from conversations
      where created_at >= ${startIso} and created_at < ${endIso}
        and jsonb_array_length(messages) > 0
      group by client_id
    `) as CountRow[];
    leadRows = (await sql`
      select client_id, name, email, phone, summary
      from leads
      where kind = 'qualifie'
        and created_at >= ${startIso} and created_at < ${endIso}
        and (coalesce(email, '') <> '' or coalesce(phone, '') <> '')
      order by created_at asc
    `) as LeadRow[];
    f3Rows = (await sql`
      select client_id, count(*)::int as n
      from leads
      where followup_3_sent_at >= ${startIso} and followup_3_sent_at < ${endIso}
      group by client_id
    `) as CountRow[];
    f7Rows = (await sql`
      select client_id, count(*)::int as n
      from leads
      where followup_7_sent_at >= ${startIso} and followup_7_sent_at < ${endIso}
      group by client_id
    `) as CountRow[];
  } catch (err) {
    console.error("[cron/rapport-mensuel] lecture des données impossible", err);
    return NextResponse.json(
      { error: "Lecture des données impossible." },
      { status: 502 }
    );
  }

  const convByClient = new Map(convRows.map((r) => [r.client_id, r.n]));
  const f3ByClient = new Map(f3Rows.map((r) => [r.client_id, r.n]));
  const f7ByClient = new Map(f7Rows.map((r) => [r.client_id, r.n]));
  const leadsByClient = new Map<string, LeadRow[]>();
  for (const l of leadRows) {
    const arr = leadsByClient.get(l.client_id);
    if (arr) arr.push(l);
    else leadsByClient.set(l.client_id, [l]);
  }

  console.log(
    `[cron/rapport-mensuel] ${monthLabel} — ${clients.length} client(s) actif(s)`
  );

  const results: Outcome[] = [];
  let budgetReached = false;

  for (const client of clients) {
    const base: Outcome = {
      id: client.id,
      agency_name: client.agency_name,
      status: "skipped",
    };

    const conversations = convByClient.get(client.id) ?? 0;
    if (conversations < 1) {
      // Zéro conversation concrète ce mois → pas de rapport.
      base.reason = "aucune conversation ce mois";
      results.push(base);
      console.log(
        `[cron/rapport-mensuel] SKIP ${client.agency_name} : 0 conversation`
      );
      continue;
    }

    if (Date.now() - startedAt > HARD_BUDGET_MS) {
      budgetReached = true;
      base.reason = "budget temps atteint, rapport reporté";
      results.push(base);
      continue;
    }

    const leads = leadsByClient.get(client.id) ?? [];
    const stats: MonthlyStats = {
      conversations,
      qualifiedLeads: leads.length,
      followup3: f3ByClient.get(client.id) ?? 0,
      followup7: f7ByClient.get(client.id) ?? 0,
      leads: leads.map((l) => ({
        name: l.name,
        email: l.email,
        phone: l.phone,
        summary: l.summary,
      })),
    };
    const mc: MailClient = {
      id: client.id,
      agency_name: client.agency_name,
      owner_email: client.owner_email,
      owner_phone: client.owner_phone,
    };

    try {
      const forOwner = monthlyReportEmail(mc, stats, monthLabel, {
        forSelvema: false,
      });
      await resend.emails.send({
        from: FROM_EMAIL,
        to: client.owner_email,
        replyTo: JB_EMAIL,
        subject: forOwner.subject,
        html: forOwner.html,
      });

      const forSelvema = monthlyReportEmail(mc, stats, monthLabel, {
        forSelvema: true,
      });
      await resend.emails.send({
        from: FROM_EMAIL,
        to: JB_EMAIL,
        replyTo: client.owner_email,
        subject: forSelvema.subject,
        html: forSelvema.html,
      });

      results.push({
        ...base,
        status: "sent",
        conversations,
        qualifiedLeads: stats.qualifiedLeads,
        followup3: stats.followup3,
        followup7: stats.followup7,
        reason: undefined,
      });
      console.log(
        `[cron/rapport-mensuel] OK ${client.agency_name} : ${conversations} conv, ${stats.qualifiedLeads} lead(s), J+3 ${stats.followup3}, J+7 ${stats.followup7}`
      );
    } catch (err) {
      // Un échec d'envoi ne bloque pas les clients suivants.
      const message = err instanceof Error ? err.message : "erreur inconnue";
      results.push({ ...base, status: "error", reason: message });
      console.error(
        `[cron/rapport-mensuel] ECHEC ${client.agency_name} : ${message}`
      );
    }

    await sleep(CLIENT_DELAY_MS);
  }

  const summary = {
    ran_at: new Date(startedAt).toISOString(),
    period: { start: startIso, end: endIso, label: monthLabel },
    total_active: clients.length,
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    budget_reached: budgetReached,
    results,
  };
  console.log(
    `[cron/rapport-mensuel] fin : ${summary.sent} envoyé(s), ${summary.errors} échec(s), ${summary.skipped} ignoré(s)`
  );
  return NextResponse.json(summary);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
