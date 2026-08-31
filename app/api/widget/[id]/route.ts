import { NextResponse } from "next/server";
import { getClient, clientReady } from "@/lib/db";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=60, s-maxage=60",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Métadonnées publiques du widget d'un client (nom, accroche, couleur).
// Consommé par public/widget.js sur le site du client → CORS ouvert.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await getClient(params.id);
    if (!client) {
      return NextResponse.json(
        { error: "Client inconnu." },
        { status: 404, headers: CORS }
      );
    }
    return NextResponse.json(
      {
        agency_name: client.agency_name,
        tagline: client.tagline,
        widget_color: client.widget_color || "#882de1",
        ready: clientReady(client),
      },
      { headers: CORS }
    );
  } catch (err) {
    console.error("widget meta error", err);
    return NextResponse.json(
      { error: "indisponible" },
      { status: 502, headers: CORS }
    );
  }
}
