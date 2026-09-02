import { neon } from "@neondatabase/serverless";

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(process.env.DATABASE_URL, {
    fetchOptions: { cache: "no-store" },
  });
}

export type Client = {
  id: string;
  created_at: string;
  updated_at: string;
  agency_name: string;
  owner_email: string;
  owner_phone: string;
  active: boolean;
  site_url: string;
  chatbot_config: string; // prompt "base de connaissances" propre au client
  tagline: string;
  // Couleurs du widget.
  widget_color: string; //     contours : bords/bordures du widget
  background_color: string; //  fond de la zone de conversation (80 %)
  bubble_color: string; //      fond des bulles de l'assistant (texte blanc)
  tagline_color: string; //     couleur du texte de la phrase d'accroche
  top_bg_color: string; //      fond de la zone haute personnage (20 %)
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Lead = {
  id: string;
  client_id: string;
  conversation_id: string | null;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  project_type: string | null;
  budget: string | null;
  property_type: string | null;
  location: string | null;
  timeline: string | null;
  situation: string | null;
  summary: string | null;
  kind: "qualifie" | "rappel";
  status: "nouveau" | "relance_j3_envoyee" | "relance_j7_envoyee" | "clos";
  followup_3_sent_at: string | null;
  followup_7_sent_at: string | null;
  last_followup_at: string | null;
};

/** Ligne enrichie pour les cards du dashboard. */
export type ClientOverview = Client & {
  leads_this_month: number;
  leads_total: number;
  last_activity: string;
};

export async function getClient(id: string): Promise<Client | null> {
  const sql = getDb();
  const rows = (await sql`select * from clients where id = ${id}`) as Client[];
  return rows[0] ?? null;
}

export async function listClientOverviews(): Promise<ClientOverview[]> {
  const sql = getDb();
  return (await sql`
    select
      c.*,
      (select count(*)::int from leads l
         where l.client_id = c.id
           and l.created_at >= date_trunc('month', now())) as leads_this_month,
      (select count(*)::int from leads l where l.client_id = c.id) as leads_total,
      greatest(
        c.updated_at,
        coalesce((select max(created_at) from leads l where l.client_id = c.id), c.created_at),
        coalesce((select max(updated_at) from conversations cv where cv.client_id = c.id), c.created_at)
      ) as last_activity
    from clients c
    order by c.active desc, last_activity desc
  `) as ClientOverview[];
}

/** L'assistant d'un client ne répond que s'il est actif et a une base de connaissances. */
export function clientReady(client: Client | null): client is Client {
  return Boolean(client && client.active && client.chatbot_config.trim());
}

/** Tous les clients actifs, les plus anciennement modifiés d'abord. */
export async function listActiveClients(): Promise<Client[]> {
  const sql = getDb();
  return (await sql`
    select * from clients
    where active = true
    order by updated_at asc
  `) as Client[];
}

/** Remplace uniquement la base de connaissances d'un client. */
export async function updateClientKnowledgeBase(
  id: string,
  chatbotConfig: string
): Promise<void> {
  const sql = getDb();
  await sql`
    update clients
    set chatbot_config = ${chatbotConfig}, updated_at = now()
    where id = ${id}
  `;
}
