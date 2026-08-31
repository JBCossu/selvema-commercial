import Link from "next/link";
import { notFound } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import CopyButton from "@/components/CopyButton";
import LeadsTable from "@/components/LeadsTable";
import { getClient, getDb } from "@/lib/db";
import type { Lead } from "@/lib/db";
import { integrationSnippet } from "@/lib/widget";

export const dynamic = "force-dynamic";

async function loadLeads(clientId: string): Promise<Lead[]> {
  const sql = getDb();
  return (await sql`
    select * from leads where client_id = ${clientId} order by created_at desc limit 500
  `) as Lead[];
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-white/40">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-white/85">
        {value.trim() || "—"}
      </dd>
    </div>
  );
}

export default async function ClientPage({
  params,
}: {
  params: { id: string };
}) {
  let client;
  try {
    client = await getClient(params.id);
  } catch {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <AdminHeader />
        <div className="mt-10 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          Impossible de charger ce client (base Neon inaccessible).
        </div>
      </div>
    );
  }
  if (!client) notFound();

  let leads: Lead[] = [];
  let leadsError = false;
  try {
    leads = await loadLeads(client.id);
  } catch {
    leadsError = true;
  }

  const snippet = integrationSnippet(client.id);
  const leadsThisMonth = leads.filter(
    (l) => new Date(l.created_at).getMonth() === new Date().getMonth() &&
      new Date(l.created_at).getFullYear() === new Date().getFullYear()
  ).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <AdminHeader />

      <div className="mt-10 animate-fade-in-up">
        <Link
          href="/dashboard"
          className="text-sm text-white/50 transition-colors hover:text-white"
        >
          ← Tous les clients
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {client.agency_name}
          </h1>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs ${
              client.active
                ? "border-[#22c55e]/50 text-[#22c55e]"
                : "border-white/20 text-white/40"
            }`}
          >
            {client.active ? "Actif" : "Inactif"}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/50">
          {leads.length} lead{leads.length > 1 ? "s" : ""} au total · {leadsThisMonth}{" "}
          ce mois
        </p>

        {/* Configuration */}
        <section className="mt-8 rounded-2xl border border-[#882de1] bg-black p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Configuration de l'agence</h2>
            <Link
              href={`/client/${client.id}/modifier`}
              className="rounded-full border border-[#882de1] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:border-[#c39bf0] hover:bg-[#882de1]/15"
            >
              Modifier la configuration
            </Link>
          </div>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Info label="Email du dirigeant" value={client.owner_email} />
            <Info label="Téléphone du dirigeant" value={client.owner_phone} />
            <Info label="URL du site" value={client.site_url} />
            <div>
              <dt className="text-xs uppercase tracking-wider text-white/40">
                Apparence du widget
              </dt>
              <dd className="mt-1 flex items-center gap-3 text-sm text-white/85">
                <span
                  className="inline-block h-5 w-5 rounded-full border border-white/20"
                  style={{ backgroundColor: client.widget_color || "#882de1" }}
                />
                <code className="text-white/60">
                  {client.widget_color || "#882de1"}
                </code>
              </dd>
              <dd className="mt-1 text-sm italic text-white/70">
                « {client.tagline || "—"} »
              </dd>
            </div>
            <div className="sm:col-span-2">
              <Info
                label="Base de connaissances (propre à ce client)"
                value={client.chatbot_config}
              />
            </div>
          </dl>
          <p className="mt-4 text-xs text-white/40">
            Le comportement de l'assistant (ton, périmètre immobilier,
            qualification des prospects) est défini par un prompt système fixe,
            commun à tous les clients.
          </p>
        </section>

        {/* Script d'intégration */}
        <section className="mt-6 rounded-2xl border border-[#882de1] bg-black p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Script d'intégration</h2>
              <p className="mt-1 text-sm text-white/50">
                Identifiant widget :{" "}
                <code className="text-[#c39bf0]">{client.id}</code>
              </p>
            </div>
            <CopyButton text={snippet} />
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-[#882de1]/50 bg-[#0c0c14] p-4 text-sm text-[#c39bf0]">
            <code>{snippet}</code>
          </pre>
        </section>

        {/* Leads */}
        <section className="mt-6">
          <h2 className="mb-4 text-lg font-semibold">Leads générés</h2>
          {leadsError ? (
            <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              Impossible de charger les leads.
            </div>
          ) : (
            <LeadsTable leads={leads} />
          )}
        </section>
      </div>
    </div>
  );
}
