import type { LeadScoreCategory } from "./db";

/**
 * Métadonnées d'affichage du score (sans dépendance au SDK Anthropic), pour
 * être importables partout : dashboard, emails, etc.
 * Barème : 25 + 20 + 15 + 20 + 20 = 100.
 *   🟢 80-100 : Priorité haute
 *   🟠 50-79  : À suivre
 *   🔴 0-49   : Faible potentiel
 */

export function scoreCategory(score: number): LeadScoreCategory {
  if (score >= 80) return "haute";
  if (score >= 50) return "a_suivre";
  return "faible";
}

export const SCORE_META: Record<
  LeadScoreCategory,
  { label: string; emoji: string; color: string; range: string }
> = {
  haute: { label: "Priorité haute", emoji: "🟢", color: "#22c55e", range: "80-100" },
  a_suivre: { label: "À suivre", emoji: "🟠", color: "#f59e0b", range: "50-79" },
  faible: { label: "Faible potentiel", emoji: "🔴", color: "#ef4444", range: "0-49" },
};
