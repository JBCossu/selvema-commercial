import ChatWidget from "@/components/ChatWidget";
import EmbedBodyClass from "./EmbedBodyClass";
import { getConfig, isConfigReady } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmbedPage() {
  let agencyName = "Assistant";
  let ready = false;
  try {
    const config = await getConfig();
    ready = isConfigReady(config);
    if (config?.agency_name) agencyName = config.agency_name;
  } catch {
    ready = false;
  }

  return (
    <div className="h-screen w-screen">
      <EmbedBodyClass />
      <ChatWidget agencyName={agencyName} ready={ready} embedded />
    </div>
  );
}
