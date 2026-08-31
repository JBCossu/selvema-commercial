import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Client } from "@/lib/db";

export const dynamic = "force-dynamic";

const field = (b: Record<string, unknown>, k: string) =>
  typeof b[k] === "string" ? (b[k] as string).trim() : "";

const DEFAULT_TAGLINE = "Une question ? Je suis là pour vous aider.";
const DEFAULT_COLOR = "#882de1";
const normColor = (v: string) =>
  /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : DEFAULT_COLOR;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getDb();
    const rows = (await sql`
      select * from clients where id = ${params.id}
    `) as Client[];
    if (!rows[0]) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }
    return NextResponse.json({ client: rows[0] });
  } catch (err) {
    console.error("client GET error", err);
    return NextResponse.json({ error: "Base inaccessible." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const agency_name = field(body, "agency_name");
  const owner_email = field(body, "owner_email");
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

  const owner_phone = field(body, "owner_phone");
  const site_url = field(body, "site_url");
  const chatbot_config = field(body, "chatbot_config");
  const tagline = field(body, "tagline") || DEFAULT_TAGLINE;
  const widget_color = normColor(field(body, "widget_color"));
  const active = body.active !== false;

  try {
    const sql = getDb();
    const rows = (await sql`
      update clients set
        agency_name = ${agency_name},
        owner_email = ${owner_email},
        owner_phone = ${owner_phone},
        site_url = ${site_url},
        chatbot_config = ${chatbot_config},
        tagline = ${tagline},
        widget_color = ${widget_color},
        active = ${active},
        updated_at = now()
      where id = ${params.id}
      returning *
    `) as Client[];
    if (!rows[0]) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }
    return NextResponse.json({ client: rows[0] });
  } catch (err) {
    console.error("client PATCH error", err);
    return NextResponse.json(
      { error: "Impossible d'enregistrer (base de données)." },
      { status: 500 }
    );
  }
}
