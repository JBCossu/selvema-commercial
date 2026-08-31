import { APP_URL } from "./resend";

/** Script d'intégration unique à coller sur le site du client. */
export function integrationSnippet(clientId: string): string {
  return `<script src="${APP_URL}/widget.js" data-selvema-client="${clientId}" async></script>`;
}

export function embedUrl(clientId: string): string {
  return `${APP_URL}/embed?c=${encodeURIComponent(clientId)}`;
}
