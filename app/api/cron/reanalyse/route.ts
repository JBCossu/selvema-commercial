import { NextResponse } from "next/server";
import { listActiveClients, updateClientKnowledgeBase } from "@/lib/db";
import { isPublicHttpUrl, analyzeSite } from "@/lib/analyze";

export const dynamic = "force-dynamic";
// Plafond du plan Vercel Hobby. Une passe ne traite alors qu'un client ou deux ;
// l'ordre `updated_at asc` fait que les suivants passent en priorité au run
// d'après (les non traités sont renvoyés en "skipped").
export const maxDuration = 60;

const CLIENT_DELAY_MS = 10_000; // pause entre deux clients (ménage l'API Anthropic)
const HARD_BUDGET_MS = 55_000; // marge avant que la plateforme ne coupe la fonction
const PER_CLIENT_RESERVE_MS = 45_000; // temps mini estimé pour traiter un client

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

type Outcome = {
  id: string;
  agency_name: string;
  site_url: string;
  status: "ok" | "skipped" | "error";
  pages?: number;
  jsWarning?: boolean;
  reason?: string;
  ms?: number;
};

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurée." },
      { status: 500 }
    );
  }

  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  let clients;
  try {
    clients = await listActiveClients();
  } catch (err) {
    console.error("[cron/reanalyse] lecture des clients impossible", err);
    return NextResponse.json(
      { error: "Lecture des clients impossible." },
      { status: 502 }
    );
  }

  console.log(
    `[cron/reanalyse] démarrage : ${clients.length} client(s) actif(s)`
  );

  const results: Outcome[] = [];
  let budgetReached = false;

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const base: Outcome = {
      id: client.id,
      agency_name: client.agency_name,
      site_url: client.site_url,
      status: "skipped",
    };

    // Garde-fou temps : on n'entame pas un client qu'on ne pourra pas finir.
    if (elapsed() + PER_CLIENT_RESERVE_MS > HARD_BUDGET_MS) {
      budgetReached = true;
      base.reason = "budget temps atteint, réanalyse reportée";
      results.push(base);
      console.warn(
        `[cron/reanalyse] SKIP ${client.agency_name} (${client.id}) : ${base.reason}`
      );
      continue;
    }

    const url = isPublicHttpUrl(client.site_url ?? "");
    if (!url) {
      base.reason = "URL du site absente ou invalide";
      results.push(base);
      console.warn(
        `[cron/reanalyse] SKIP ${client.agency_name} (${client.id}) : ${base.reason}`
      );
      continue;
    }

    const t0 = Date.now();
    try {
      const { config, pages, jsWarning } = await analyzeSite(url);
      if (!config.trim()) throw new Error("base de connaissances vide");
      await updateClientKnowledgeBase(client.id, config);
      const outcome: Outcome = {
        ...base,
        status: "ok",
        pages: pages.length,
        jsWarning,
        ms: Date.now() - t0,
      };
      results.push(outcome);
      console.log(
        `[cron/reanalyse] OK ${client.agency_name} (${client.id}) : ${
          pages.length
        } page(s), ${outcome.ms} ms${jsWarning ? ", ⚠️ site JS dynamique" : ""}`
      );
    } catch (err) {
      // Un site inaccessible ou une erreur d'analyse ne doit pas arrêter le cron.
      const message = err instanceof Error ? err.message : "erreur inconnue";
      results.push({
        ...base,
        status: "error",
        reason: message,
        ms: Date.now() - t0,
      });
      console.error(
        `[cron/reanalyse] ECHEC ${client.agency_name} (${client.id}) : ${message}`
      );
    }

    // Pause entre deux clients, si un client reste et que le budget le permet.
    const hasNext = i < clients.length - 1;
    if (
      hasNext &&
      elapsed() + CLIENT_DELAY_MS + PER_CLIENT_RESERVE_MS <= HARD_BUDGET_MS
    ) {
      await sleep(CLIENT_DELAY_MS);
    }
  }

  const summary = {
    ran_at: new Date(startedAt).toISOString(),
    duration_ms: elapsed(),
    total: clients.length,
    ok: results.filter((r) => r.status === "ok").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    budget_reached: budgetReached,
    results,
  };
  console.log(
    `[cron/reanalyse] fin : ${summary.ok} ok, ${summary.errors} échec(s), ${summary.skipped} ignoré(s) en ${summary.duration_ms} ms`
  );
  return NextResponse.json(summary);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
