// Applique scripts/schema.sql à la base Neon pointée par DATABASE_URL.
// Usage : `npm run db:setup`  (nécessite un fichier .env.local avec DATABASE_URL)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL manquant (définissez-le dans .env.local).");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(join(here, "schema.sql"), "utf8");

// Découpe naïve sur `;` en fin de ligne — suffisant pour ce schéma.
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  process.stdout.write("• " + statement.split("\n")[0].slice(0, 70) + " … ");
  await sql.query(statement);
  console.log("ok");
}

console.log("\nSchéma appliqué avec succès.");
