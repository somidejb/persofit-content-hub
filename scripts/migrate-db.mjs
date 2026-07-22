/**
 * One-shot data migration: OLD Neon database → NEW Neon database
 *
 * Tables migrated (in dependency order, foreign keys respected):
 *   Settings → TiktokAccount → SlideshowTemplate → SlideshowTemplateSlide
 *   → Slideshow → Slide → Schedule → PostHistory → SlideshowTemplateRun
 *
 * Usage:
 *   1. Add OLD_DATABASE_URL to .env (direct/non-pooled connection string)
 *   2. Ensure DATABASE_URL in .env points to the NEW database
 *   3. node scripts/migrate-db.mjs
 */

import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env manually (no dotenv dependency needed) ──────────────────────────
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)="?([^"#\n]*)"?/);
  if (match) env[match[1]] = match[2].trim();
}

const OLD_URL = env.OLD_DATABASE_URL;
const NEW_URL = env.DIRECT_URL; // always use direct (non-pooled) for bulk inserts

if (!OLD_URL) {
  console.error("❌  OLD_DATABASE_URL not found in .env — add it and re-run.");
  process.exit(1);
}
if (!NEW_URL) {
  console.error("❌  DIRECT_URL not found in .env.");
  process.exit(1);
}

const src = new pg.Client({ connectionString: OLD_URL });
const dst = new pg.Client({ connectionString: NEW_URL });

// ── Helpers ───────────────────────────────────────────────────────────────────

function cols(row) {
  return Object.keys(row);
}

function placeholders(row) {
  return Object.keys(row).map((_, i) => `$${i + 1}`).join(", ");
}

function values(row) {
  return Object.values(row);
}

async function migrateTable(tableName) {
  const { rows } = await src.query(`SELECT * FROM "${tableName}"`);
  if (rows.length === 0) {
    console.log(`  ⊙  ${tableName}: 0 rows (skipped)`);
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const c = cols(row);
    const sql = `
      INSERT INTO "${tableName}" (${c.map(k => `"${k}"`).join(", ")})
      VALUES (${placeholders(row)})
      ON CONFLICT (id) DO NOTHING
    `;
    try {
      const res = await dst.query(sql, values(row));
      if (res.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.warn(`  ⚠  ${tableName} row ${row.id} skipped: ${err.message}`);
      skipped++;
    }
  }

  console.log(`  ✓  ${tableName}: ${inserted} inserted, ${skipped} skipped`);
}

// ── Run migration ─────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔗  Connecting to databases…");
  await src.connect();
  await dst.connect();
  console.log("    OLD →", OLD_URL.replace(/:[^@]+@/, ":***@"));
  console.log("    NEW →", NEW_URL.replace(/:[^@]+@/, ":***@"));

  // Verify that the content hub tables actually exist in the old DB
  const { rows: oldTables } = await src.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const oldTableNames = oldTables.map(r => r.tablename);
  console.log("\n📋  Tables found in OLD database:", oldTableNames.join(", "));

  const hubTables = [
    "Settings",
    "TiktokAccount",
    "SlideshowTemplate",
    "SlideshowTemplateSlide",
    "Slideshow",
    "Slide",
    "Schedule",
    "PostHistory",
    "SlideshowTemplateRun",
  ];

  const missing = hubTables.filter(t => !oldTableNames.includes(t));
  if (missing.length) {
    console.warn(`\n⚠  Tables not found in OLD DB: ${missing.join(", ")}`);
    console.warn("   They will be skipped.");
  }

  console.log("\n🚀  Migrating tables…");
  for (const table of hubTables) {
    if (!oldTableNames.includes(table)) continue;
    await migrateTable(table);
  }

  console.log("\n✅  Migration complete!");
}

main()
  .catch((err) => {
    console.error("\n❌  Migration failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await src.end().catch(() => {});
    await dst.end().catch(() => {});
  });
