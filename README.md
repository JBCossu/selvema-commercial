# Selvema Commercial

Back-office **multi-clients** de Jean Baptiste : gérer plusieurs agences
immobilières, chacune avec son propre widget chatbot de qualification de
prospects. Design system Selvema (dégradé `#000000 → #1e1ca8`, violet `#882de1`,
texte blanc, Inter).

## Architecture

| Route | Rôle | Accès |
|---|---|---|
| `/login` | Connexion admin (mot de passe unique `ADMIN_PASSWORD`) | public |
| `/dashboard` | **Panneau de contrôle** : tous les clients en cards (nom, leads du mois, statut, dernière activité, « Voir le détail ») | admin |
| `/client/[id]` | Fiche agence : configuration (dont accroche + couleur), script d'intégration, leads + statut relances J+3 / J+7, « Modifier la configuration » | admin |
| `/client/[id]/modifier` | Édition config + analyse de site + activation/désactivation | admin |
| `/clients/nouveau` | Création d'un client (avec **analyse automatique du site**) → génère le script d'intégration unique | admin |
| `/embed?c=<id>` | UI du chatbot chargée dans l'iframe du widget (scopée à un client, couleur du client) | public |
| `/widget.js` | Script embarquable : défaut **320×480**, redimensionnable (`resize:both`, min 280×380 / max 500×700, jamais hors écran), flotte en boucle (`translateY -12px↔0`, 2 s) ; le × la réduit en barre compacte. Après ~2,5 s → zoom `scale .5→1` puis `postMessage selvema-frame-shown` à l'iframe qui joue la séquence : personnage qui monte (`translateY 40→0`, 600 ms) +1 s, puis accroche machine à écrire (50 ms/lettre) +1 s | public |
| `/api/widget/[id]` | Métadonnées publiques du widget (accroche, couleur) — CORS ouvert | public |
| `/api/clients/analyze` | Visite une URL, extrait le texte, génère la config chatbot via l'API Anthropic | admin |

### Multi-tenant

- Chaque **client** = une ligne dans `clients` (UUID = identifiant du widget).
- Le script d'intégration porte cet ID :
  `<script src="…/widget.js" data-selvema-client="<uuid>" async></script>`.
- `widget.js` lit l'attribut, injecte une iframe `/embed?c=<uuid>` (mini-fenêtre
  bas-droite qui apparaît après 2 s, flotte en boucle, s'agrandit au 1er message,
  se ferme via ×) et récupère la couleur via `/api/widget/<uuid>`.
- `conversations` et `leads` sont rattachés à un `client_id` (FK, `on delete cascade`).
- L'assistant d'un client ne répond que si le client est `active` et a une base de
  connaissances (`chatbot_config` non vide).
- Chaque client a sa **phrase d'accroche** (`tagline`) et sa **couleur principale**
  (`widget_color`, `#882de1`). Elle pilote (via la variable CSS `--sv-accent`) :
  personnage SVG, ligne de séparation, messages de l'assistant, bouton d'envoi,
  halo de la zone haute. Fond général `#0a0a1a` ; messages du visiteur en blanc
  sur fond clair. L'accroche s'affiche sur 2 lignes (coupée à la 1re ponctuation
  forte), 2e ligne en gros.
- Le personnage : mascotte vectorielle en `path` (contours lisses) — tête, cou,
  torse galbé, 2 bras effilés, petite goutte évidée sur le torse ; corps en
  `fill="var(--sv-accent)"`, yeux/sourire/goutte en blanc. Pas de jambes ; le
  torse est coupé par l'`overflow:hidden` de la zone haute. Montée en CSS
  (`.selvema-char`, `translateY(44px)→0`, 600 ms, delay 3 s).
- **Ouverture automatique** : `mount()` → `setTimeout(showFrame, 2000)` — le
  widget s'ouvre seul après 2 s, toujours, aucun clic. Pas de bouton/icône.
- **Cadre invisible avant l'ouverture** : `outer` démarre en `visibility:hidden`
  + `opacity:0` + `pointer-events:none` + `box-shadow:none` + `border:0` +
  `resize:none` → aucune trace au chargement. `showFrame` (à 2 s) rend visible
  (fondu + zoom) ; `collapse` (croix) remasque tout et affiche la barre mini
  (sans bordure ni ombre). `widget.js` servi en `Cache-Control: no-cache`.

### Deux prompts distincts

| | Où | Portée |
|---|---|---|
| **Prompt système** | `lib/knowledge.ts` → `SYSTEM_PROMPT` (constante) | **Fixe**, commun à tous les clients : identité (assistant de l'agence, jamais « une IA »), ton pro + chaleureux, périmètre immobilier uniquement, questions de qualification (projet, budget, bien, localisation, délai, situation), jamais de prix ferme sans l'agent, génération de la fiche prospect, honnêteté si la question dépasse la base. |
| **Base de connaissances** | colonne `clients.chatbot_config` | **Par client** : description, services, zones, biens disponibles, FAQ probable. Générée par l'analyse du site puis relue/modifiée. |

`lib/anthropic.ts` (`runChat`) combine les deux à chaque conversation :
`system = SYSTEM_PROMPT + "\n\n" + knowledgeBasePrompt(client)` — prompt système
d'abord, base de connaissances du client ensuite.

### Analyse automatique du site

Sur `/clients/nouveau` (et `/client/[id]/modifier`) : champ **URL du site** +
bouton **Analyser le site**. `POST /api/clients/analyze` récupère la page avec
`fetch`, en extrait le texte, et demande à l'API Anthropic la **base de
connaissances** (description, services, zones, biens, FAQ probable — aucune
consigne de comportement). Le résultat remplit le textarea **Base de
connaissances de l'agence** (`chatbot_config`), relu et modifiable avant
enregistrement.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **API Anthropic** — modèle `claude-sonnet-4-6` (`CHAT_MODEL` dans `lib/anthropic.ts`), boucle d'outils manuelle (`enregistrer_prospect`, `demander_rappel`)
- **Resend** — fiches prospects, relances, notifications dirigeant
- **Neon PostgreSQL** — tables `clients`, `conversations`, `leads`

## Mise en route

```bash
npm install
cp .env.local.example .env.local     # renseigner les vraies valeurs
npm run db:setup                      # applique scripts/schema.sql sur Neon
npm run dev                           # http://localhost:3002
```

> **Migration base existante** : `scripts/schema.sql` ajoute désormais les
> colonnes `site_url`, `chatbot_config`, `tagline`, `widget_color` à `clients`
> (via `alter table ... add column if not exists`). Ré-exécuter
> `npm run db:setup` — ou coller le fichier dans la console SQL Neon — suffit,
> les données existantes sont conservées.

> `db:setup` se connecte en **TCP direct (5432)** via le driver `pg`, et non via
> le driver HTTP `@neondatabase/serverless` (fetch 443) — cela évite les
> `ECONNREFUSED :443` derrière un proxy/pare-feu. Si le 5432 est aussi bloqué :
> `DB_SETUP_DRIVER=http npm run db:setup`. L'app en runtime continue d'utiliser
> le driver serverless (adapté à Vercel).

### Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion Neon PostgreSQL |
| `ANTHROPIC_API_KEY` | Clé API Anthropic |
| `RESEND_API_KEY` | Clé API Resend |
| `RESEND_FROM_EMAIL` | Adresse d'envoi vérifiée (déf. `onboarding@resend.dev`) |
| `ADMIN_PASSWORD` | Mot de passe du back-office |
| `CRON_SECRET` | Secret attendu par `/api/cron/relances` |
| `NEXT_PUBLIC_APP_URL` | URL publique du déploiement (script widget + liens emails) |

## Relances automatiques

`vercel.json` déclenche `GET /api/cron/relances` chaque jour à 08:00 UTC (Vercel
ajoute `Authorization: Bearer $CRON_SECRET`). Le job parcourt **tous les clients
actifs** : J+3 puis J+7, email au prospect + notification au dirigeant, mise à
jour du statut du lead. « Marquer traité » sur la fiche client passe le lead en
`clos` et stoppe les relances.

Déclenchement manuel : `curl "https://DOMAINE/api/cron/relances?secret=CRON_SECRET"`

## Notifications SMS

Le téléphone du dirigeant est stocké et affiché ; les notifications partent
aujourd'hui **par email** (Resend ne fait pas de SMS). Points d'appel isolés dans
`app/api/chat` et `app/api/cron/relances` pour brancher un fournisseur SMS.

## Tester le widget en local

`test.html` à la racine est un **site client fictif** (Agence Horizon Immobilier)
avec le script du widget déjà intégré. Serveur lancé (`./start.sh`), il suffit
d'ouvrir `test.html` dans le navigateur : le widget apparaît en bas à droite.
Il pointe vers le client de démo `0c54b42f-…` (visible dans `/dashboard`) ;
pour tester un autre client, remplacer `data-selvema-client` par son ID.

## Démarrage automatique (macOS)

Script `start.sh` à la racine :

```bash
./start.sh          # lance `npm run dev` en arrière-plan (logs → logs/dev.log)
./start.sh status   # affiche l'état
./start.sh stop     # arrête le serveur
```

### Le lancer au démarrage de la session (launchd)

1. Créer `~/Library/LaunchAgents/com.selvema.commercial.plist` :

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
     "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>Label</key>
     <string>com.selvema.commercial</string>
     <key>ProgramArguments</key>
     <array>
       <string>/Users/jeanbaptiste/Selvema/commercial/start.sh</string>
     </array>
     <key>RunAtLoad</key>
     <true/>
     <key>WorkingDirectory</key>
     <string>/Users/jeanbaptiste/Selvema/commercial</string>
     <key>StandardOutPath</key>
     <string>/Users/jeanbaptiste/Selvema/commercial/logs/launchd.out.log</string>
     <key>StandardErrorPath</key>
     <string>/Users/jeanbaptiste/Selvema/commercial/logs/launchd.err.log</string>
     <key>EnvironmentVariables</key>
     <dict>
       <key>PATH</key>
       <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
     </dict>
   </dict>
   </plist>
   ```

   (Adapter le `PATH` si `node`/`npm` sont ailleurs — `which npm` pour vérifier.)

2. Charger l'agent :

   ```bash
   launchctl load ~/Library/LaunchAgents/com.selvema.commercial.plist
   ```

   Il se lancera à chaque ouverture de session. Pour le désactiver :
   `launchctl unload ~/Library/LaunchAgents/com.selvema.commercial.plist`.

### Alternative sans terminal

Réglages Système → Général → **Ouverture** → **+** → sélectionner `start.sh`
(ou un petit `.app` Automator « Exécuter un script shell » appelant
`/Users/jeanbaptiste/Selvema/commercial/start.sh`).

## Structure

```
app/
  page.tsx                     Redirection → /dashboard
  login/                       Connexion admin
  dashboard/                   Cards clients
  client/[id]/                 Fiche client (config + script + leads)
  client/[id]/modifier/        Édition de la config d'un client
  clients/nouveau/             Création client + génération du script
  embed/                       UI chatbot (iframe), scopée par ?c=<clientId>
  api/
    chat/                      Boucle conversationnelle (scopée client) + emails
    clients/                   POST création, GET liste
    clients/[id]/              PATCH mise à jour config
    clients/analyze/           Analyse d'un site → config chatbot (Anthropic)
    leads/[id]/                PATCH statut / DELETE
    widget/[id]/               Métadonnées publiques du widget (CORS)
    auth/{login,logout}/       Session admin (cookie HMAC)
    cron/relances/             Relances J+3 / J+7 tous clients actifs
components/
  AdminHeader, ClientCard, ClientForm, LeadsTable, ChatWidget,
  LoginForm, CopyButton, Logo, LogoutButton
lib/
  db.ts        Client Neon + types (Client, Lead) + requêtes dashboard
  anthropic.ts Client Anthropic + runChat() — combine SYSTEM_PROMPT + base de connaissances
  analyze.ts   fetchPageText() + generateChatbotConfig() (analyse de site → base de connaissances)
  knowledge.ts SYSTEM_PROMPT (fixe) + knowledgeBasePrompt(client) + TOOLS
  emails.ts    Gabarits HTML (fiche, relances, notifications)
  widget.ts    integrationSnippet(clientId) / embedUrl(clientId)
  resend.ts / session.ts
public/widget.js               Script embarquable (accroche + couleur client)
scripts/schema.sql             Schéma PostgreSQL (+ ALTER pour les nouvelles colonnes)
start.sh                       Démarrage/arrêt du serveur dev en arrière-plan
```
