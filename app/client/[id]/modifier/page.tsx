import Link from "next/link";
import { notFound } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import ClientForm from "@/components/ClientForm";
import { getClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
}: {
  params: { id: string };
}) {
  let client;
  try {
    client = await getClient(params.id);
  } catch {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <AdminHeader />
        <div className="mt-10 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          Impossible de charger ce client (base Neon inaccessible).
        </div>
      </div>
    );
  }
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <AdminHeader />

      <div className="mt-10 animate-fade-in-up">
        <Link
          href={`/client/${client.id}`}
          className="text-sm text-white/50 transition-colors hover:text-white"
        >
          ← Retour à la fiche client
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Modifier — {client.agency_name}
        </h1>

        <div className="mt-8">
          <ClientForm
            mode="edit"
            clientId={client.id}
            initial={{
              agency_name: client.agency_name,
              owner_email: client.owner_email,
              owner_phone: client.owner_phone,
              site_url: client.site_url,
              chatbot_config: client.chatbot_config,
              tagline: client.tagline,
              widget_color: client.widget_color,
              active: client.active,
            }}
          />
        </div>
      </div>
    </div>
  );
}
