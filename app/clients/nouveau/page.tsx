import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import ClientForm from "@/components/ClientForm";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <AdminHeader />

      <div className="mt-10 animate-fade-in-up">
        <Link
          href="/dashboard"
          className="text-sm text-white/50 transition-colors hover:text-white"
        >
          ← Tous les clients
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Nouveau client</h1>
        <p className="mt-2 text-sm text-white/60">
          Renseignez l'agence et sa base de connaissances. Un script d'intégration
          unique sera généré automatiquement à la création.
        </p>

        <div className="mt-8">
          <ClientForm mode="create" />
        </div>
      </div>
    </div>
  );
}
