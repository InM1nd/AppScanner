import "dotenv/config";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { assertE2EDatabaseUrl } from "./assert-e2e-database";

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required.");
assertE2EDatabaseUrl(sourceUrl);

const upgradeUrl = new URL(sourceUrl);
upgradeUrl.pathname = "/appscanner_upgrade_e2e";
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";

async function query(connectionString: string, sql: string) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

async function main() {
  await query(
    adminUrl.toString(),
    "DROP DATABASE IF EXISTS appscanner_upgrade_e2e WITH (FORCE)",
  );
  await query(adminUrl.toString(), "CREATE DATABASE appscanner_upgrade_e2e");

  for (const migration of [
    "20260727155756_init",
    "20260728135117_add_lystio_provider",
  ]) {
    const sql = await readFile(
      `prisma/migrations/${migration}/migration.sql`,
      "utf8",
    );
    await query(upgradeUrl.toString(), sql);
    execFileSync(
      "npx",
      ["prisma", "migrate", "resolve", "--applied", migration],
      {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: upgradeUrl.toString() },
      },
    );
  }

  await query(
    upgradeUrl.toString(),
    `INSERT INTO "Provider" (id, name, "displayName", "updatedAt")
   VALUES ('upgrade-provider', 'MANUAL', 'Manual', CURRENT_TIMESTAMP);
   INSERT INTO "Listing" (id, title, "providerId", "canonicalUrl", "importMethod", "updatedAt")
   VALUES
     ('upgrade-1', 'One', 'upgrade-provider', 'https://example.com/Listing?id=1', 'MANUAL', CURRENT_TIMESTAMP),
     ('upgrade-2', 'Two', 'upgrade-provider', 'https://example.com/Listing?id=2', 'MANUAL', CURRENT_TIMESTAMP);`,
  );

  execFileSync("npm", ["run", "db:e2e:migrate"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: upgradeUrl.toString() },
  });

  const upgraded = await query(
    upgradeUrl.toString(),
    `SELECT "normalizedCanonicalUrl", "duplicateClusterId", "recomputePending"
   FROM "Listing" ORDER BY id`,
  );

  if (
    upgraded.rows.length !== 2 ||
    upgraded.rows[0].normalizedCanonicalUrl ===
      upgraded.rows[1].normalizedCanonicalUrl ||
    upgraded.rows.some(
      (row) => row.duplicateClusterId !== null || row.recomputePending !== true,
    )
  ) {
    throw new Error(
      "Upgrade migration corrupted URL identity or skipped recomputation.",
    );
  }

  console.log(
    "Upgrade migration preserved distinct listings and queued recomputation.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
