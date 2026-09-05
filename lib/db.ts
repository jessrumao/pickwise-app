// Shared Postgres connection pool (L5 storage -- users/profile_versions/
// decision_records, plus the Auth.js adapter tables). Everything else (L0-L4)
// lives in git and is imported at build time; only runtime writes belong here.
//
// Lazy + cached on globalThis so Next.js dev-server hot-reload doesn't leak a
// new pool per edit, and so importing this module never opens a connection
// (or throws for missing config) until a query actually runs.
import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. See env.template -- Package C needs a Postgres instance (Vercel Postgres or Neon)."
      );
    }
    global.__pgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // Neon/Vercel Postgres require TLS. Set DATABASE_SSL=false only for a
      // local Postgres that doesn't have it configured.
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }
  return global.__pgPool;
}
