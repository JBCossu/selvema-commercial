import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import type { Lead } from "@/lib/db";
import { getResend, FROM_EMAIL } from "@/lib/resend";
import { relanceResponseNotice, type MailClient } from "@/lib/emails";
import { verifyRelance } from "@/lib/relance-token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Merci pour votre réponse",
  robots: { index: false, follow: false },
};

type JoinedLead = Lead & {
  c_id: string;
  agency_name: string;
  owner_email: string;
  owner_phone: string;
};

type State = "invalid" | "oui" | "non" | "already";

/**
 * Page PUBLIQUE ouverte par le prospect depuis un bouton d'email de relance
 * (lien signé `?l=<leadId>&r=oui|non&s=<sig>`). Elle enregistre la réponse,
 * met le lead à jour (statut « a_rappeler » ou « clos ») et prévient le
 * dirigeant par email. Idempotente : un lien déjà utilisé n'envoie rien de
 * nouveau. Non listée dans le middleware → aucune connexion requise.
 */
export default async function RelancePage({
  searchParams,
}: {
  searchParams: { l?: string; r?: string; s?: string };
}) {
  const l = typeof searchParams.l === "string" ? searchParams.l : "";
  const r = typeof searchParams.r === "string" ? searchParams.r : "";
  const s = typeof searchParams.s === "string" ? searchParams.s : "";

  let state: State = "invalid";
  let agency = "";

  if (l && verifyRelance(l, r, s)) {
    try {
      const sql = getDb();
      const rows = (await sql`
        select l.*, c.id as c_id, c.agency_name, c.owner_email, c.owner_phone
        from leads l
        join clients c on c.id = l.client_id
        where l.id = ${l}
      `) as JoinedLead[];
      const lead = rows[0];

      if (lead) {
        agency = lead.agency_name;

        if (lead.relance_response != null) {
          state = "already";
        } else {
          const newStatus = r === "oui" ? "a_rappeler" : "clos";
          const updated = (await sql`
            update leads
            set relance_response = ${r},
                relance_response_at = now(),
                status = ${newStatus},
                last_followup_at = now()
            where id = ${l} and relance_response is null
            returning id
          `) as { id: string }[];

          // Seule la 1re requête qui bascule le lead envoie la notification.
          if (updated.length > 0) {
            const client: MailClient = {
              id: lead.c_id,
              agency_name: lead.agency_name,
              owner_email: lead.owner_email,
              owner_phone: lead.owner_phone,
            };
            try {
              const notice = relanceResponseNotice(client, lead, r);
              await getResend().emails.send({
                from: FROM_EMAIL,
                to: client.owner_email,
                subject: notice.subject,
                html: notice.html,
              });
            } catch (err) {
              console.error("relance notice error", err);
            }
          }
          state = r === "oui" ? "oui" : "non";
        }
      }
    } catch (err) {
      console.error("relance page error", err);
      state = "invalid";
    }
  }

  const a = agency || "l'agence";
  const content: Record<State, { emoji: string; title: string; text: string }> = {
    oui: {
      emoji: "🎉",
      title: "Merci beaucoup !",
      text: `Un conseiller de ${a} va vous rappeler très vite pour parler de votre projet. À très bientôt.`,
    },
    non: {
      emoji: "🙂",
      title: "C'est noté, merci pour votre retour.",
      text: "Nous restons à votre disposition si votre projet évolue. Belle journée à vous.",
    },
    already: {
      emoji: "✅",
      title: "Votre réponse a bien été prise en compte.",
      text: `Merci, il n'y a rien de plus à faire. ${a} revient vers vous si besoin.`,
    },
    invalid: {
      emoji: "🔗",
      title: "Ce lien n'est plus valide.",
      text: "Il a sans doute déjà été utilisé, ou l'adresse est incomplète. Vous pouvez simplement répondre à l'email si vous souhaitez nous joindre.",
    },
  };
  const c = content[state];

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[#882de1] bg-black p-8 text-center">
        <div className="text-4xl">{c.emoji}</div>
        <h1 className="mt-4 text-xl font-semibold text-white">{c.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{c.text}</p>
        <p className="mt-7 text-xs uppercase tracking-widest text-white/25">
          Selvema
        </p>
      </div>
    </div>
  );
}
