import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * True si la requête courante porte une session admin valide (cookie HMAC non
 * expiré). Une seule session admin existe (le mot de passe de Jean Baptiste) et
 * elle donne accès à toutes les agences ; il n'y a pas de compte par agence.
 */
export async function isAdmin(): Promise<boolean> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * Garde à appeler en TÊTE de chaque route qui lit ou modifie des données
 * sensibles (leads, clients). Renvoie une réponse 401 générique si la session
 * admin est absente ou invalide, sinon `null` (la route continue).
 *
 * Double verrou volontaire avec `middleware.ts` : même si le `matcher` du
 * middleware venait à changer, la route refuserait toujours un visiteur non
 * authentifié qui devine un identifiant dans l'URL.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json(
    { error: "Authentification requise." },
    { status: 401 }
  );
}
