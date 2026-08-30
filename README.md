# Selvema Commercial

Assistant IA de qualification de prospects pour agences immobilières indépendantes.
Design system identique à selvema.com (dégradé `#000000 → #1e1ca8`, contours `#882de1`,
texte blanc, Inter, animations fade-in, logo Selvema en haut à gauche).

## Les trois parties

| Partie | Où | Rôle |
|---|---|---|
| **1 — Configuration** | `/config` (protégée par mot de passe) | Selvema renseigne, une fois par client : nom de l'agence, email + téléphone du dirigeant, description, FAQ, biens disponibles. C'est la base de connaissances de l'agent. |
| **2 — Chatbot** | widget injecté par `<script>` sur le site du client | Se présente comme l'assistant de l'agence, répond **uniquement** à partir de la base de connaissances, qualifie le prospect (type de projet, budget, bien, localisation, délai, situation), envoie une **fiche prospect** par email au dirigeant via Resend. Si la question sort du périmètre : propose un rappel et collecte les coordonnées. |
| **3 — Relances** | `/api/cron/relances` (cron quotidien) + `/dashboard` | J+3 puis J+7 : email de relance au prospect via Resend, notification au dirigeant à chaque envoi. Le tableau de bord liste les prospects et leur statut. |

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **API Anthropic** — modèle `claude-sonnet-4-6` (constante `CHAT_MODEL` dans `lib/anthropic.ts`)
- **Resend** — emails (fiche prospect, relances, notifications)
- **Neon PostgreSQL** — `config`, `conversations`, `prospects`

## Mise en route

```bash
npm install
cp .env.local.example .env.local     # puis renseigner les vraies valeurs
npm run db:setup                      # applique scripts/schema.sql sur Neon
npm run dev                           # http://localhost:3002
```

### Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion Neon PostgreSQL |
| `ANTHROPIC_API_KEY` | Clé API Anthropic |
| `RESEND_API_KEY` | Clé API Resend |
| `RESEND_FROM_EMAIL` | Adresse d'envoi vérifiée (déf. `onboarding@resend.dev`, test only) |
| `APP_PASSWORD` | Mot de passe d'accès à `/config` et `/dashboard` |
| `CRON_SECRET` | Secret attendu par `/api/cron/relances` (`Authorization: Bearer …`) |
| `NEXT_PUBLIC_APP_URL` | URL publique du déploiement (widget + liens des emails) |

## Intégration du widget sur le site du client

Une seule balise, juste avant `</body>`, sur n'importe quelle page :

```html
<script src="https://VOTRE-DOMAINE/widget.js" async></script>
```

`widget.js` (`public/widget.js`) injecte un bouton flottant en bas à droite et une
iframe vers `/embed`. L'iframe est même-origine que l'API : aucun souci de CORS.
`/embed` est la seule route autorisée à être affichée en iframe
(`frame-ancestors *`, configuré dans `next.config.mjs`).

## Relances automatiques

`vercel.json` déclenche `GET /api/cron/relances` tous les jours à 08:00 UTC.
Vercel ajoute automatiquement l'en-tête `Authorization: Bearer $CRON_SECRET`.

Déclenchement manuel :

```bash
curl "https://VOTRE-DOMAINE/api/cron/relances?secret=VOTRE_CRON_SECRET"
```

- **J+3** : prospect qualifié, avec email, `created_at` ≥ 3 jours, statut ≠ `clos`.
- **J+7** : idem, ≥ 7 jours, et J+3 déjà envoyée.
- À chaque envoi : email au prospect **et** notification au dirigeant, puis mise à
  jour du statut (`relance_j3_envoyee` / `relance_j7_envoyee`).
- Dans `/dashboard`, « Marquer comme traité » passe le prospect en `clos` et stoppe
  les relances (équivaut à « le prospect a répondu »).

## Notifications SMS

Le téléphone du dirigeant est stocké et affiché dans les fiches. Les notifications
sont aujourd'hui envoyées **par email** via Resend (Resend n'envoie pas de SMS).
Pour de vrais SMS, brancher un fournisseur (Twilio, Brevo, OVH…) dans
`lib/emails.ts` / les routes `api/chat` et `api/cron/relances` — les points d'appel
sont isolés.

## Structure

```
app/
  page.tsx                  Accueil : 4 encadrés cliquables (config / chatbot / relances / intégration)
  login/                    Connexion (mot de passe unique)
  config/                   Base de connaissances de l'agence (protégée)
  chatbot/                  Aperçu visuel du widget (conversation d'exemple, public)
  relances/                 Tableau simple des prospects et de leur statut de relance (protégée)
  integration/              Balise script à coller sur le site du client (public)
  dashboard/                Suivi détaillé des prospects + changement de statut (protégée)
  embed/                    UI du chatbot (chargée dans l'iframe du widget)
  api/
    chat/                   Boucle conversationnelle + outils + email dirigeant
    config/                 Lecture/écriture de la config
    auth/{login,logout}/    Session signée (cookie HMAC)
    prospects/[id]/         Changement de statut / suppression
    cron/relances/          Relances J+3 / J+7
components/                  Logo, ChatWidget, ConfigForm, ProspectsTable…
lib/
  db.ts                     Client Neon + types + helpers config
  anthropic.ts              Client Anthropic + runChat (boucle d'outils)
  knowledge.ts              Prompt système + définition des outils
  emails.ts                 Gabarits HTML (fiche, relances, notifications)
  resend.ts / session.ts
public/widget.js            Script d'intégration embarquable
scripts/schema.sql          Schéma PostgreSQL
```
