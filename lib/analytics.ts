import { getDb } from "./db";

/**
 * Funnel analytique d'un client, calculé en direct depuis `conversations` et
 * `leads` (Neon). Chaque étape est un sous-ensemble de la précédente : on part
 * des conversations démarrées sur la période, puis on regarde ce qu'elles sont
 * devenues (coordonnées laissées → lead qualifié 80+ → relance J+3 → J+7).
 */

export type FunnelPeriod = "mois" | "mois_dernier" | "3mois" | "tout";

export const FUNNEL_PERIODS: { key: FunnelPeriod; label: string }[] = [
  { key: "mois", label: "Ce mois" },
  { key: "mois_dernier", label: "Le mois dernier" },
  { key: "3mois", label: "3 derniers mois" },
  { key: "tout", label: "Tout" },
];

export function isFunnelPeriod(v: unknown): v is FunnelPeriod {
  return v === "mois" || v === "mois_dernier" || v === "3mois" || v === "tout";
}

/** Bornes [from, to[ de la période, en ISO (mois calendaires UTC). */
export function funnelRange(period: FunnelPeriod): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // 1er du mois (mm peut déborder, Date.UTC normalise).
  const monthStart = (mm: number) => new Date(Date.UTC(y, mm, 1)).toISOString();
  const nextMonth = monthStart(m + 1);

  switch (period) {
    case "mois":
      return { from: monthStart(m), to: nextMonth };
    case "mois_dernier":
      return { from: monthStart(m - 1), to: monthStart(m) };
    case "3mois":
      return { from: monthStart(m - 2), to: nextMonth };
    case "tout":
      return { from: new Date(Date.UTC(2000, 0, 1)).toISOString(), to: nextMonth };
  }
}

export type FunnelStage = { key: string; label: string; count: number };

export type ClientFunnel = {
  period: FunnelPeriod;
  from: string;
  to: string;
  stages: FunnelStage[];
};

export async function getClientFunnel(
  clientId: string,
  period: FunnelPeriod
): Promise<ClientFunnel> {
  const { from, to } = funnelRange(period);
  const sql = getDb();

  const rows = (await sql`
    select
      count(distinct c.id)::int                                                        as conversations,
      count(distinct c.id) filter (
        where l.email is not null or l.phone is not null
      )::int                                                                           as contacts,
      count(distinct c.id) filter (
        where l.kind = 'qualifie' and l.score >= 80
      )::int                                                                           as qualifies,
      count(distinct c.id) filter (where l.followup_3_sent_at is not null)::int        as relance_j3,
      count(distinct c.id) filter (where l.followup_7_sent_at is not null)::int        as relance_j7
    from conversations c
    left join leads l on l.conversation_id = c.id
    where c.client_id = ${clientId}
      and c.created_at >= ${from}
      and c.created_at < ${to}
  `) as Record<string, number>[];

  const r = rows[0] ?? {};
  return {
    period,
    from,
    to,
    stages: [
      { key: "conversations", label: "Conversations démarrées", count: r.conversations ?? 0 },
      { key: "contacts", label: "Coordonnées laissées", count: r.contacts ?? 0 },
      { key: "qualifies", label: "Leads qualifiés (80+)", count: r.qualifies ?? 0 },
      { key: "relance_j3", label: "Relances J+3", count: r.relance_j3 ?? 0 },
      { key: "relance_j7", label: "Relances J+7", count: r.relance_j7 ?? 0 },
    ],
  };
}

/** Taux de conversion entre deux étapes, arrondi ; null si l'étape amont est à 0. */
export function stageRate(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  return `${Math.round((current / previous) * 100)}%`;
}
