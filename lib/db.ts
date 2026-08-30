import { neon } from "@neondatabase/serverless";

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(process.env.DATABASE_URL, {
    fetchOptions: { cache: "no-store" },
  });
}

export type AgencyConfig = {
  id: number;
  agency_name: string;
  owner_email: string;
  owner_phone: string;
  description: string;
  faq: string;
  properties: string;
  updated_at: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Prospect = {
  id: string;
  created_at: string;
  conversation_id: string | null;
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

export async function getConfig(): Promise<AgencyConfig | null> {
  const sql = getDb();
  const rows =
    (await sql`select * from config where id = 1`) as AgencyConfig[];
  return rows[0] ?? null;
}

export function isConfigReady(config: AgencyConfig | null): config is AgencyConfig {
  return Boolean(
    config &&
      config.agency_name.trim() &&
      config.owner_email.trim() &&
      config.description.trim()
  );
}
