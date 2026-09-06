import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { genericError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "nouveau",
  "relance_j3_envoyee",
  "relance_j7_envoyee",
  "clos",
]);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!body.status || !ALLOWED.has(body.status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  let rows: { id: string; status: string }[];
  try {
    const sql = getDb();
    rows = (await sql`
      update leads set status = ${body.status} where id = ${params.id}
      returning id, status
    `) as { id: string; status: string }[];
  } catch (err) {
    console.error("lead PATCH error", err);
    return genericError(500);
  }

  if (!rows[0]) {
    return NextResponse.json({ error: "Lead introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lead: rows[0] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const sql = getDb();
    await sql`delete from leads where id = ${params.id}`;
  } catch (err) {
    console.error("lead DELETE error", err);
    return genericError(500);
  }
  return NextResponse.json({ ok: true });
}
