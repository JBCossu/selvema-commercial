import Link from "next/link";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import ProspectsTable from "@/components/ProspectsTable";
import { getDb, getConfig, isConfigReady } from "@/lib/db";
import type { Prospect } from "@/lib/db";

export const dynamic = "force-dynamic";

async function loadData() {
  const sql = getDb();
  const prospects = (await sql`
    select * from prospects order by created_at desc limit 200
  `) as Prospect[];
  const conv = (await sql`select count(*)::int as n from conversations`) as {
    n: number;
  }[];
  return { prospects, conversations: conv[0]?.n ?? 0 };
}

export default async function DashboardPage() {
  let prospects: Prospect[] = [];
  let conversations = 0;
  let ready = false;
  let error = false;
  try {
    ready = isConfigReady(await getConfig());
    const data = await loadData();
    prospects = data.prospects;
    conversations = data.conversations;
  } catch {
    error = true;
  }

  const active = prospects.filter((p) => p.status !== "clos").length;
  const relances = prospects.filter(
    (p) => p.followup_3_sent_at || p.followup_7_sent_at
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-5 text-sm text-white/70">
          <Link href="/config" className="transition-colors hover:text-white">
            Configuration
          </Link>
          <Link href="/relances" className="transition-colors hover:text-white">
            Relances
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="mt-10 animate-fade-in-up">
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="mt-2 text-sm text-white/60">
          Prospects qualifiés par l'assistant et suivi des relances automatiques.
        </p>

        {!ready && (
          <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            La configuration de l'agence est incomplète — l'assistant ne répondra
            pas tant que le nom, l'email du dirigeant et la description ne sont
            pas renseignés dans{" "}
            <Link href="/config" className="underline">
              /config
            </Link>
            .
          </div>
        )}

        {error ? (
          <div className="mt-6 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            Impossible de charger les données. Vérifiez que la base Neon est
            accessible et que le schéma a été appliqué (<code>npm run db:setup</code>).
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              <Stat label="Prospects (total)" value={prospects.length} />
              <Stat label="En cours" value={active} />
              <Stat label="Relances envoyées" value={relances} />
              <Stat label="Conversations" value={conversations} />
            </div>

            <div className="mt-8">
              <ProspectsTable prospects={prospects} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-white/50">
        {label}
      </div>
    </div>
  );
}
