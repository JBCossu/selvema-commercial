import { NextResponse } from "next/server";
import { getDb, getClient } from "@/lib/db";
import { getResend, FROM_EMAIL } from "@/lib/resend";
import {
  monthlyReportEmail,
  type MailClient,
  type MonthlyStats,
} from "@/lib/emails";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Envoi MANUEL et IMMÉDIAT du bilan mensuel d'un client — bouton « Tester le
 * bilan mensuel » du back-office. Tests internes uniquement : n'attend pas le
 * 1er du mois, prend le mois EN COURS jusqu'à maintenant, envoie au dirigeant
 * avec un objet préfixé [TEST] et ne saute pas les clients sans conversation.
 *
 * Route protégée par le middleware (/api/clients/*) → admin connecté uniquement.
 */

type LeadRow = {
  name: string | null;
  email: string | null;
  phone: string | null;
  summary: string | null;
};

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  let client;
  try {
    client = await getClient(params.id);
  } catch {
    return NextResponse.json({ error: "Base inaccessible." }, { status: 502 });
  }
  if (!client) {
    return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY non configurée." },
      { status: 500 }
    );
  }

  // Mois en cours, du 1er (UTC) jusqu'à maintenant.
  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const startIso = periodStart.toISOString();
  const endIso = now.toISOString();
  const monthLabel =
    periodStart.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }) + " (à ce jour)";

  const sql = getDb();
  let convN: number;
  let leads: LeadRow[];
  let f3: number;
  let f7: number;
  try {
    const [c, l, a, b] = await Promise.all([
      sql`select count(*)::int as n from conversations
          where client_id = ${client.id}
            and created_at >= ${startIso} and created_at < ${endIso}
            and jsonb_array_length(messages) > 0`,
      sql`select name, email, phone, summary from leads
          where client_id = ${client.id} and kind = 'qualifie'
            and created_at >= ${startIso} and created_at < ${endIso}
            and (coalesce(email, '') <> '' or coalesce(phone, '') <> '')
          order by created_at asc`,
      sql`select count(*)::int as n from leads
          where client_id = ${client.id}
            and followup_3_sent_at >= ${startIso} and followup_3_sent_at < ${endIso}`,
      sql`select count(*)::int as n from leads
          where client_id = ${client.id}
            and followup_7_sent_at >= ${startIso} and followup_7_sent_at < ${endIso}`,
    ]);
    convN = (c as { n: number }[])[0]?.n ?? 0;
    leads = l as LeadRow[];
    f3 = (a as { n: number }[])[0]?.n ?? 0;
    f7 = (b as { n: number }[])[0]?.n ?? 0;
  } catch (err) {
    console.error("test-rapport lecture données", err);
    return NextResponse.json(
      { error: "Lecture des données impossible." },
      { status: 502 }
    );
  }

  const stats: MonthlyStats = {
    conversations: convN,
    qualifiedLeads: leads.length,
    followup3: f3,
    followup7: f7,
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
    const mail = monthlyReportEmail(mc, stats, monthLabel, { forSelvema: false });
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: client.owner_email,
      subject: `[TEST] ${mail.subject}`,
      html: mail.html,
    });
  } catch (err) {
    console.error("test-rapport envoi", err);
    return NextResponse.json(
      { error: "Échec de l'envoi via Resend." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    to: client.owner_email,
    month: monthLabel,
    conversations: stats.conversations,
    qualifiedLeads: stats.qualifiedLeads,
    followup3: stats.followup3,
    followup7: stats.followup7,
  });
}
