import Link from "next/link";
import type { ClientOverview } from "@/lib/db";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function ClientCard({ client }: { client: ClientOverview }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#882de1] bg-black p-6 transition-all duration-150 hover:-translate-y-1 hover:border-[#c39bf0] hover:shadow-[0_10px_40px_-12px_rgba(136,45,225,0.6)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-tight">
          {client.agency_name}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
            client.active
              ? "border-[#22c55e]/50 text-[#22c55e]"
              : "border-white/20 text-white/40"
          }`}
        >
          {client.active ? "Actif" : "Inactif"}
        </span>
      </div>

      <dl className="mt-5 space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-white/50">Leads ce mois</dt>
          <dd className="text-2xl font-bold text-[#c39bf0]">
            {client.leads_this_month}
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-white/50">Leads au total</dt>
          <dd className="font-medium text-white/80">{client.leads_total}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-white/50">Dernière activité</dt>
          <dd className="font-medium text-white/80">
            {timeAgo(client.last_activity)}
          </dd>
        </div>
      </dl>

      <Link
        href={`/client/${client.id}`}
        className="btn-ghost mt-6 w-full"
      >
        Voir le détail
      </Link>
    </div>
  );
}
