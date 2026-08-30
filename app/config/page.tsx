import Link from "next/link";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import ConfigForm from "@/components/ConfigForm";

export const dynamic = "force-dynamic";

export default function ConfigPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-5 text-sm text-white/70">
          <Link href="/relances" className="transition-colors hover:text-white">
            Relances
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-white">
            Tableau de bord
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="mt-10 animate-fade-in-up">
        <h1 className="text-2xl font-bold tracking-tight">
          Configuration de l'agence
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Ces informations constituent la base de connaissances de l'assistant.
          À renseigner une seule fois par Selvema pour chaque client.
        </p>

        <div className="mt-8">
          <ConfigForm />
        </div>
      </div>
    </div>
  );
}
