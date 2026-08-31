import ChatWidget from "@/components/ChatWidget";
import EmbedBodyClass from "./EmbedBodyClass";
import { getClient, clientReady } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const clientId = typeof searchParams.c === "string" ? searchParams.c : "";

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
    if (client?.background_color) bgColor = client.background_color;
    if (client?.bubble_color) bubbleColor = client.bubble_color;
    if (client?.tagline_color) taglineColor = client.tagline_color;
    if (client?.top_bg_color) topBgColor = client.top_bg_color;
  } catch {
    ready = false;
  }

  return (
    <div className="h-screen w-screen">
      <EmbedBodyClass />
      <ChatWidget
        clientId={clientId}
        agencyName={agencyName}
        tagline={tagline}
        ready={ready}
        borderColor={borderColor}
        bgColor={bgColor}
        bubbleColor={bubbleColor}
        taglineColor={taglineColor}
        topBgColor={topBgColor}
      />
    </div>
  );
}
