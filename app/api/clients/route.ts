import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Client } from "@/lib/db";
import { integrationSnippet } from "@/lib/widget";

export const dynamic = "force-dynamic";

const field = (b: Record<string, unknown>, k: string) =>
  typeof b[k] === "string" ? (b[k] as string).trim() : "";

const DEFAULT_TAGLINE = "Une question ? Je suis là pour vous aider.";
const DEFAULT_COLOR = "#882de1";

const normColor = (v: string) =>
  /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : DEFAULT_COLOR;

export async function GET() {
  try {
    const sql = getDb();
    const clients = (await sql`
      select * from clients order by active desc, agency_name asc
    `) as Client[];
    return NextResponse.json({ clients });
  } catch (err) {
    console.error("clients GET error", err);
    return NextResponse.json(
      { clients: [], error: "Base de données inaccessible." },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const agency_name = field(body, "agency_name");
  const owner_email = field(body, "owner_email");
  const owner_phone = field(body, "owner_phone");
  const site_url = field(body, "site_url");
  const chatbot_config = field(body, "chatbot_config");
  const tagline = field(body, "tagline") || DEFAULT_TAGLINE;
  const widget_color = normColor(field(body, "widget_color"));

  if (!agency_name || !owner_email) {
    return NextResponse.json(
      { error: "Le nom de l'agence et l'email du dirigeant sont obligatoires." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email)) {
    return NextResponse.json(
      { error: "L'email du dirigeant est invalide." },
      { status: 400 }
    );
  }

  try {
    const sql = getDb();
    const rows = (await sql`
      insert into clients
        (agency_name, owner_email, owner_phone, site_url, chatbot_config,
         tagline, widget_color)
      values
        (${agency_name}, ${owner_email}, ${owner_phone}, ${site_url},
         ${chatbot_config}, ${tagline}, ${widget_color})
      returning *
    `) as Client[];
    const client = rows[0];
    return NextResponse.json({
      client,
      snippet: integrationSnippet(client.id),
    });
  } catch (err) {
    console.error("clients POST error", err);
    return NextResponse.json(
      { error: "Impossible de créer le client (base de données)." },
      { status: 500 }
    );
  }
}
