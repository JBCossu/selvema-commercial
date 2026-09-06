import ChatWidget from "@/components/ChatWidget";
import EmbedBodyClass from "./EmbedBodyClass";
import { getClient, clientReady } from "@/lib/db";
import {
  isVisitorId,
  getVisitorMemory,
  returningGreeting,
} from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: { c?: string; t?: string; v?: string };
}) {
  const clientId = typeof searchParams.c === "string" ? searchParams.c : "";
  // Accroche contextuelle passée par widget.js (ex. page de bien). Prioritaire
  // sur l'accroche configurée en base. Bornée pour éviter tout abus.
  const taglineOverride =
    typeof searchParams.t === "string" && searchParams.t.trim()
      ? searchParams.t.trim().slice(0, 200)
      : "";
  // Identifiant visiteur anonyme (mémoire).
  const visitorId = isVisitorId(searchParams.v) ? searchParams.v : "";

  if (!clientId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black p-6 text-center text-sm text-white/60">
        <EmbedBodyClass />
        Widget non configuré : identifiant client manquant dans le script
        d'intégration.
      </div>
    );
  }

  let agencyName = "Assistant";
  let ready = false;
  let tagline = "Une question ? Je suis là pour vous aider.";
  let returnGreeting = ""; // accueil « content de vous revoir » si visiteur connu
  // Couleurs du widget.
  let borderColor = "#882de1";
  let bgColor = "#0a0a1a";
  let bubbleColor = "#882de1";
  let taglineColor = "#ffffff";
  let topBgColor = "#000000";
  try {
    const client = await getClient(clientId);
    ready = clientReady(client);
    if (client?.agency_name) agencyName = client.agency_name;
    if (client?.tagline) tagline = client.tagline;
    if (client?.widget_color) borderColor = client.widget_color;
    // (override d'accroche appliqué plus bas, après le bloc try)
    if (client?.background_color) bgColor = client.background_color;
    if (client?.bubble_color) bubbleColor = client.bubble_color;
    if (client?.tagline_color) taglineColor = client.tagline_color;
    if (client?.top_bg_color) topBgColor = client.top_bg_color;

    if (ready && visitorId) {
      const mem = await getVisitorMemory(clientId, visitorId);
      if (mem) returnGreeting = returningGreeting(mem);
    }
  } catch {
    ready = false;
  }

  if (taglineOverride) tagline = taglineOverride;

  return (
    <div className="h-screen w-screen">
      <EmbedBodyClass />
      <ChatWidget
        clientId={clientId}
        agencyName={agencyName}
        tagline={tagline}
        ready={ready}
        visitorId={visitorId || undefined}
        returnGreeting={returnGreeting || undefined}
        borderColor={borderColor}
        bgColor={bgColor}
        bubbleColor={bubbleColor}
        taglineColor={taglineColor}
        topBgColor={topBgColor}
      />
    </div>
  );
}
