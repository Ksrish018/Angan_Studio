// Creates tables and a demo designer roster. Run: npm run db:migrate
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });

// Placeholder roster until Nikhil shares the real designers. example.com addresses never receive mail.
const DEMO_DESIGNERS = [
  ["Meera Sathe", "meera.sathe@example.com", true],
  ["Aryan Joshi", "aryan.joshi@example.com", false],
  ["Kavya Rao", "kavya.rao@example.com", false],
  ["Rohan Pathak", "rohan.pathak@example.com", false],
  ["Isha Bhide", "isha.bhide@example.com", false],
  ["Farhan Shaikh", "farhan.shaikh@example.com", false],
] as const;

async function main() {
  await pool.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  for (const [name, email, principal] of DEMO_DESIGNERS) {
    await pool.query(
      `insert into designers (name, email, is_principal, is_demo) values ($1, $2, $3, true) on conflict (email) do nothing`,
      [name, email, principal],
    );
  }
  const { rows } = await pool.query("select count(*)::int as n from designers");
  console.log(`Schema ready. ${rows[0].n} designers.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
