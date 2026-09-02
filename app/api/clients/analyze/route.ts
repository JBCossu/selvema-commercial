import { NextResponse } from "next/server";
import { isPublicHttpUrl, analyzeSite } from "@/lib/analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const url = isPublicHttpUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "URL invalide. Indiquez une adresse publique en http(s)." },
      { status: 400 }
    );
  }

  try {
    const { config, pages, jsWarning } = await analyzeSite(url);
    if (!config) {
      return NextResponse.json(
        { error: "Le modèle n'a rien renvoyé, réessayez." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      config,
      pagesVisited: pages.length,
      pages,
      jsWarning,
    });
  } catch (err) {
    console.error("analyzeSite error", err);
    const message =
      err instanceof Error ? err.message : "L'analyse du site a échoué.";
    return NextResponse.json(
      { error: `L'analyse du site a échoué (${message}).` },
      { status: 502 }
    );
  }
}
