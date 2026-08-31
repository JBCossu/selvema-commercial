import { NextResponse } from "next/server";
import {
  isPublicHttpUrl,
  fetchPageText,
  generateChatbotConfig,
} from "@/lib/analyze";

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

  let pageText: string;
  try {
    pageText = await fetchPageText(url);
  } catch (err) {
    console.error("fetchPageText error", err);
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer le site (" +
          (err instanceof Error ? err.message : "erreur réseau") +
          ").",
      },
      { status: 502 }
    );
  }

  try {
    const config = await generateChatbotConfig(pageText, url.toString());
    if (!config) {
      return NextResponse.json(
        { error: "Le modèle n'a rien renvoyé, réessayez." },
        { status: 502 }
      );
    }
    return NextResponse.json({ config });
  } catch (err) {
    console.error("generateChatbotConfig error", err);
    return NextResponse.json(
      { error: "L'analyse par l'IA a échoué, réessayez." },
      { status: 502 }
    );
  }
}
