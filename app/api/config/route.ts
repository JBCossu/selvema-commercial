import { NextResponse } from "next/server";
import { getDb, getConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json({ config });
  } catch (err) {
    console.error("config GET error", err);
    return NextResponse.json(
      { config: null, error: "Base de données inaccessible." },
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

  const field = (k: string) =>
    typeof body[k] === "string" ? (body[k] as string).trim() : "";

  const agency_name = field("agency_name");
  const owner_email = field("owner_email");
  const owner_phone = field("owner_phone");
  const description = field("description");
  const faq = field("faq");
  const properties = field("properties");

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

  const sql = getDb();
  await sql`
    insert into config (id, agency_name, owner_email, owner_phone, description, faq, properties, updated_at)
    values (1, ${agency_name}, ${owner_email}, ${owner_phone}, ${description}, ${faq}, ${properties}, now())
    on conflict (id) do update set
      agency_name = excluded.agency_name,
      owner_email = excluded.owner_email,
      owner_phone = excluded.owner_phone,
      description = excluded.description,
      faq = excluded.faq,
      properties = excluded.properties,
      updated_at = now()
  `;

  return NextResponse.json({ ok: true });
}
