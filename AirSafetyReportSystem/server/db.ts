// Database connection using Drizzle ORM and Cloudflare D1
import { drizzle } from 'drizzle-orm/d1';
import * as schema from "@shared/schema";

// For Cloudflare Workers/Pages
export function createDB(d1Database: D1Database) {
  return drizzle(d1Database, { schema });
}

// For local development (fallback to SQLite)
let db: ReturnType<typeof drizzle>;
if (typeof globalThis.D1Database === 'undefined') {
  // Local development - use SQLite
  const Database = await import('better-sqlite3');
  const { drizzle: drizzleSQLite } = await import('drizzle-orm/better-sqlite3');
  
  const DATABASE_URL = process.env.DATABASE_URL || './database.sqlite';
  const sqlite = new Database.default(DATABASE_URL);
  db = drizzleSQLite(sqlite, { schema });
} else {
  // Cloudflare environment - will be initialized with D1Database
  db = drizzle(globalThis.D1Database as D1Database, { schema });
}

export { db };
