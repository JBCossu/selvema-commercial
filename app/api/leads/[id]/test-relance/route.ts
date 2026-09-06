import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Lead } from "@/lib/db";
import { getResend, FROM_EMAIL, fromWithName } from "@/lib/resend";
import { followUpEmail, followUpNotice, type MailClient } from "@/lib/emails";

export const dynamic = "force-dynamic";

/**
 * Envoi MANUEL et IMMÉDIAT d'une relance J+3 ou J+7 à un prospect — bouton
 * « Tester relance J+X » du back-office. Sert uniquement à vérifier que le
 * système d'emails fonctionne : ça n'attend pas les délais réels et ça ne
 * modifie PAS l'état du lead (dates de relance, statut) — le cron quotidien
 * fait toujours son travail normalement.
 *
 * Route protégée par le middleware (/api/leads/*) → admin connecté uniquement.
 */

type JoinedLead = Lead & {
  c_id: string;
  agency_name: string;
  owner_email: string;
  owner_phone: string;
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: { step?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const step: 3 | 7 | null =
    body.step === 7 ? 7 : body.step === 3 ? 3 : null;
  if (!step) {
    return NextResponse.json(
      { error: "Paramètre « step » attendu : 3 ou 7." },
      { status: 400 }
    );
  }

  const sql = getDb();
  const rows = (await sql`
    select l.*, c.id as c_id, c.agency_name, c.owner_email, c.owner_phone
    from leads l
    join clients c on c.id = l.client_id
    where l.id = ${params.id}
  `) as JoinedLead[];

  const r = rows[0];
  if (!r) {
    return NextResponse.json({ error: "Lead introuvable." }, { status: 404 });
  }

  const client: MailClient = {
    id: r.c_id,
    agency_name: r.agency_name,
    owner_email: r.owner_email,
    owner_phone: r.owner_phone,
  };

  try {
    const resend = getResend();

    // TEMPORAIRE (tests internes) : le bouton est cliquable quel que soit le
    // statut du lead et même sans email prospect. Si le lead a un email, on
    // envoie la relance au prospect ; dans tous les cas on envoie la
    // notification au dirigeant. Préfixe [TEST] côté destinataires.
    let prospectSent = false;
    if (r.email) {
      const mail = followUpEmail(client, r, step);
      await resend.emails.send({
        from: fromWithName(client.agency_name),
        to: r.email,
        replyTo: client.owner_email,
        subject: `[TEST] ${mail.subject}`,
        html: mail.html,
      });
      prospectSent = true;
    }

    const notice = followUpNotice(client, r, step);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: client.owner_email,
      subject: `[TEST] ${notice.subject}`,
      html: notice.html,
    });

    return NextResponse.json({
      ok: true,
      step,
      to: r.email ?? null,
      prospect_sent: prospectSent,
      notice_to: client.owner_email,
      note: prospectSent
        ? "Test — l'état du lead n'a pas été modifié."
        : "Test — lead sans email : seule la notification au dirigeant a été envoyée.",
    });
  } catch (err) {
    console.error("test-relance error", err);
    return NextResponse.json(
      { error: "Échec de l'envoi via Resend." },
      { status: 502 }
    );
  }
}
