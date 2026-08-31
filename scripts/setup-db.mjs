// Applique scripts/schema.sql à la base Neon pointée par DATABASE_URL.
// Usage : `npm run db:setup`  (nécessite un fichier .env.local avec DATABASE_URL)
//
// Ce script se connecte en TCP direct (port 5432) via le driver `pg`, PAS via
// le driver HTTP `@neondatabase/serverless` (fetch sur le port 443). C'est ce
// qui contourne les erreurs `ECONNREFUSED :443` derrière un proxy / pare-feu
// d'entreprise : le driver serverless est fait pour l'edge (fetch/WebSocket),
// pas pour un script Node local.
//
// Si le port 5432 est lui aussi bloqué sur votre réseau, forcez le chemin HTTP
// avec  DB_SETUP_DRIVER=http npm run db:setup  (nécessite un accès sortant 443).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Charge .env.local sans dépendance externe.
try {
  const env = readFileSync(join(here, "..", ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // pas de .env.local : on compte sur l'environnement
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL manquant (définissez-le dans .env.local).");
  process.exit(1);
}

const schema = readFileSync(join(here, "schema.sql"), "utf8");
// Découpe naïve sur `;` en fin de ligne — suffisant pour ce schéma.
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

async function runWithPg() {
  const { default: pg } = await import("pg");
  const { Client } = pg;

  // Nettoie les paramètres propres à Neon que `pg` gère mal
  // (channel_binding provoque des erreurs SASL sur certaines versions),
  // et impose le TLS nous-mêmes.
  const u = new URL(rawUrl);
  for (const p of ["sslmode", "channel_binding", "options"]) {
    u.searchParams.delete(p);
  }

  const client = new Client({
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    statement_timeout: 60000,
  });

  await client.connect();
  try {
    for (const statement of statements) {
      process.stdout.write(
        "• " + statement.split("\n")[0].slice(0, 70) + " … "
      );
      await client.query(statement);
      console.log("ok");
    }
  } finally {
    await client.end();
  }
}

async function runWithHttp() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(rawUrl);
  for (const statement of statements) {
    process.stdout.write("• " + statement.split("\n")[0].slice(0, 70) + " … ");
    await sql.query(statement);
    console.log("ok");
  }
}

const driver = (process.env.DB_SETUP_DRIVER || "pg").toLowerCase();

try {
  if (driver === "http" || driver === "fetch") {
    await runWithHttp();
  } else {
    await runWithPg();
  }
  console.log("\nSchéma appliqué avec succès.");
} catch (err) {
  console.error("\nÉchec de l'application du schéma :", err.message || err);
  if (driver !== "http") {
    console.error(
      "Astuce : si le port 5432 est bloqué, essayez  DB_SETUP_DRIVER=http npm run db:setup"
    );
  }
  process.exit(1);
}
