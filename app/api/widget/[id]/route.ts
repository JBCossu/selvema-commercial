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
        // Couleurs du widget.
        widget_color: client.widget_color || "#882de1", //     contours
        background_color: client.background_color || "#0a0a1a", // fond conversation
        bubble_color: client.bubble_color || "#882de1", //     bulles assistant
        tagline_color: client.tagline_color || "#ffffff", //   texte accroche
        top_bg_color: client.top_bg_color || "#000000", //     fond zone haute (20 %)
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
