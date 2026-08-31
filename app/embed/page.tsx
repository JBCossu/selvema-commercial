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
  let color = "#882de1";
  let tagline = "Une question ? Je suis là pour vous aider.";
  try {
    const client = await getClient(clientId);
    ready = clientReady(client);
    if (client?.agency_name) agencyName = client.agency_name;
    if (client?.widget_color) color = client.widget_color;
    if (client?.tagline) tagline = client.tagline;
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
        color={color}
      />
    </div>
  );
}
