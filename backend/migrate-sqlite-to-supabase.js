require("dotenv").config();

const Database = require("better-sqlite3");
const { Pool } = require("pg");
const path = require("path");

const dbPath = path.join(__dirname, "data", "janaseva.db");

const tables = [
  "users",
  "jobs",
  "schemes",
  "feed_sources",
  "saved_jobs",
  "reminders",
  "notifications",
  "feed_items"
];

function quoteIdentifier(value) {
  return '"' + value.replace(/"/g, '""') + '"';
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from backend/.env");
  }

  const sqlite = new Database(dbPath, {
    readonly: true,
    fileMustExist: true
  });

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });

  const client = await pool.connect();

  try {
    console.log("Checking Supabase connection...");
    await client.query("SELECT 1");
    console.log("Supabase connection successful.");

    const counts = await Promise.all(
      tables.map(async table => {
        const result = await client.query(
          `SELECT COUNT(*)::int AS count FROM public.${quoteIdentifier(table)}`
        );
        return { table, count: result.rows[0].count };
      })
    );

    const occupied = counts.filter(x => x.count > 0);

    if (occupied.length) {
      throw new Error(
        "Migration stopped: destination tables are not empty: " +
        occupied.map(x => `${x.table} (${x.count})`).join(", ")
      );
    }

    const source = {};
    for (const table of tables) {
      source[table] = sqlite.prepare(
        `SELECT * FROM ${quoteIdentifier(table)}`
      ).all();
    }

    console.log("\nSource records:");
    for (const table of tables) {
      console.log(`${table}: ${source[table].length}`);
    }

    await client.query("BEGIN");

    for (const table of tables) {
      const rows = source[table];

      if (!rows.length) continue;

      for (const row of rows) {
        const columns = Object.keys(row);
        const columnSQL = columns.map(quoteIdentifier).join(", ");
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

        const sql = `
          INSERT INTO public.${quoteIdentifier(table)}
          (${columnSQL})
          VALUES (${placeholders})
        `;

        await client.query(sql, columns.map(column => row[column]));
      }

      console.log(`Migrated ${table}: ${rows.length} records`);
    }

    // Restore identity sequences after preserving existing IDs.
    for (const table of tables) {
      const hasId = sqlite.prepare(
        `PRAGMA table_info(${quoteIdentifier(table)})`
      ).all().some(column => column.name === "id");

      if (!hasId) continue;

      const sequence = await client.query(
        "SELECT pg_get_serial_sequence($1, 'id') AS seq",
        [`public.${table}`]
      );

      if (!sequence.rows[0].seq) continue;

      await client.query(
        `SELECT setval(
          $1::regclass,
          COALESCE((SELECT MAX(id) FROM public.${quoteIdentifier(table)}), 1),
          EXISTS(SELECT 1 FROM public.${quoteIdentifier(table)})
        )`,
        [sequence.rows[0].seq]
      );
    }

    await client.query("COMMIT");

    console.log("\nMigration completed successfully.");
    console.log("SQLite database was opened read-only and remains unchanged.");

    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM public.${quoteIdentifier(table)}`
      );
      console.log(`Supabase ${table}: ${result.rows[0].count}`);
    }

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("\nMigration failed:", error.message);
    process.exitCode = 1;
  } finally {
    sqlite.close();
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error("Migration could not start:", error.message);
  process.exitCode = 1;
});
