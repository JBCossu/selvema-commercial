import { NextResponse } from "next/server";
import { isPublicHttpUrl, analyzeSite } from "@/lib/analyze";
import { GENERIC_ERROR } from "@/lib/http";

// Messages « métier » que analyzeSite lève volontairement (site injoignable,
// application JS, contenu insuffisant) : sûrs à afficher tels quels. Tout autre
// message (SDK Anthropic, réseau bas niveau, bug) reste dans les logs.
const SAFE_ANALYZE_ERROR =
  /^(Le site semble|Impossible de récupérer|Aucune page exploitable|Trop peu de texte|La page n'est pas au format HTML|Redirection vers une adresse non autorisée)/;

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
    const safe =
      err instanceof Error && SAFE_ANALYZE_ERROR.test(err.message)
        ? err.message
        : GENERIC_ERROR;
    return NextResponse.json({ error: safe }, { status: 502 });
  }
}
