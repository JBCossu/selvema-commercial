import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import PageHeader from "@/components/PageHeader";
import { getDb } from "@/lib/db";
import type { Prospect } from "@/lib/db";

export const dynamic = "force-dynamic";

const DAY = 86400000;

type Relance = {
  label: string;
  className: string;
};

function relanceStatus(p: Prospect): Relance {
  if (p.status === "clos") {
    return { label: "Converti", className: "border-[#22c55e]/50 text-[#22c55e]" };
  }
  if (p.kind === "rappel") {
    return {
      label: "Demande de rappel",
      className: "border-[#c39bf0]/50 text-[#c39bf0]",
    };
  }
  if (p.followup_7_sent_at) {
    return {
      label: "Relance J+7 envoyée",
      className: "border-amber-300/50 text-amber-200",
    };
  }
  if (p.followup_3_sent_at) {
    const j7Due = new Date(p.created_at).getTime() + 7 * DAY;
    return Date.now() >= j7Due
      ? { label: "En attente J+7", className: "border-white/25 text-white/70" }
      : {
          label: "Relance J+3 envoyée",
          className: "border-amber-400/50 text-amber-300",
        };
  }
  return { label: "En attente J+3", className: "border-white/25 text-white/70" };
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function RelancesPage() {
  let prospects: Prospect[] = [];
  let error = false;
  try {
    const sql = getDb();
    prospects = (await sql`
      select * from prospects order by created_at desc limit 300
    `) as Prospect[];
  } catch {
    error = true;
  }

  const enCours = prospects.filter((p) => p.status !== "clos");

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        links={[
          { href: "/", label: "Accueil" },
          { href: "/config", label: "Configuration" },
          { href: "/dashboard", label: "Tableau de bord complet" },
        ]}
      />

      <div className="mt-10 animate-fade-in-up">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relances</h1>
            <p className="mt-2 text-sm text-white/60">
              Tous les prospects en cours et l'état de leurs relances
              automatiques J+3 et J+7.
            </p>
          </div>
          <LogoutButton />
        </div>

        {error ? (
          <div className="mt-8 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            Impossible de charger les données. Vérifiez la base Neon et le schéma
            (<code>npm run db:setup</code>).
          </div>
        ) : prospects.length === 0 ? (
          <div className="mt-8 card text-center text-white/50">
            Aucun prospect pour l'instant. Les fiches apparaîtront ici dès que
            l'assistant en aura qualifié.
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-white/50">
              {enCours.length} prospect{enCours.length > 1 ? "s" : ""} en cours ·{" "}
              {prospects.length - enCours.length} converti
              {prospects.length - enCours.length > 1 ? "s" : ""}
            </p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[#882de1]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-[#882de1]/40 text-xs uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Date de contact</th>
                    <th className="px-4 py-3 font-medium">Statut de relance</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => {
                    const r = relanceStatus(p);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {p.name || "Sans nom"}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {p.email || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-white/60">
                          {fmtDate(p.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-1 text-xs ${r.className}`}
                          >
                            {r.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-white/50">
              Pour voir le détail d'un prospect ou marquer une conversion,
              ouvrez le{" "}
              <Link href="/dashboard" className="text-[#c39bf0] hover:underline">
                tableau de bord complet
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
