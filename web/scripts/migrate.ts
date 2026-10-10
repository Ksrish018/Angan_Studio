// Creates tables and the starter designer roster. Run: npm run db:migrate
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { STARTER_TEAM } from "../src/lib/starter-team";

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });


async function main() {
  await pool.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  for (const d of STARTER_TEAM) {
    await pool.query(
      `insert into designers (name, email, is_principal, specialty, is_demo) values ($1, $2, $3, $4, true) on conflict (email) do nothing`,
      [d.name, d.email, d.principal, d.specialty],
    );
  }
  const { rows } = await pool.query("select count(*)::int as n from designers");
  console.log(`Schema ready. ${rows[0].n} designers.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
