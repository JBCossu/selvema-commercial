import { NextResponse } from "next/server";

/**
 * Message d'erreur UNIQUE présenté à l'extérieur quand quelque chose casse côté
 * serveur (base de données injoignable, API Anthropic en panne, bug inattendu…).
 * Aucun détail technique, aucune stack, aucun message interne ne doit fuir vers
 * le client : tout ça reste dans `console.error` / les logs serveur.
 *
 * Les messages de VALIDATION volontaires (« Message vide. », « Statut invalide. »,
 * « Mot de passe incorrect. »…) ne passent pas par ici : ils informent
 * légitimement l'appelant de ce qu'il doit corriger.
 */
export const GENERIC_ERROR = "Une erreur s'est produite. Veuillez réessayer.";

/** Réponse JSON générique pour une erreur serveur. Statut 500 par défaut. */
export function genericError(status = 500) {
  return NextResponse.json({ error: GENERIC_ERROR }, { status });
}
