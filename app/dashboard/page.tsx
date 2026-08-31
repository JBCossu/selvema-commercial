import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import ClientCard from "@/components/ClientCard";
import { listClientOverviews } from "@/lib/db";
import type { ClientOverview } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let clients: ClientOverview[] = [];
  let error = false;
  try {
    clients = await listClientOverviews();
  } catch {
    error = true;
  }

  const active = clients.filter((c) => c.active).length;
  const leadsThisMonth = clients.reduce((n, c) => n + c.leads_this_month, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <AdminHeader />

      <div className="mt-10 animate-fade-in-up">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Panneau de contrôle Selvema Commercial
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {clients.length} agence{clients.length > 1 ? "s" : ""} · {active} active
          {active > 1 ? "s" : ""} · {leadsThisMonth} lead
          {leadsThisMonth > 1 ? "s" : ""} généré{leadsThisMonth > 1 ? "s" : ""} ce
          mois
        </p>

        <h2 className="mt-8 text-lg font-semibold text-white/90">Clients</h2>

        {error ? (
          <div className="mt-8 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            Impossible de charger les clients. Vérifiez la base Neon et le schéma
            (<code>npm run db:setup</code>).
          </div>
        ) : clients.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-[#882de1] bg-black p-10 text-center">
            <p className="text-white/60">Aucun client pour l'instant.</p>
            <Link href="/clients/nouveau" className="btn-ghost mt-5 inline-flex">
              Créer le premier client
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
