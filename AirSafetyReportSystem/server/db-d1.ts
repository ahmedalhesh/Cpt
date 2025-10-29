// Database connection using Drizzle ORM and Cloudflare D1
import { drizzle } from 'drizzle-orm/d1';
import * as schema from "@shared/schema";

// This will be used in Cloudflare Pages Functions
export function createD1Database(d1Database: D1Database) {
  return drizzle(d1Database, { schema });
}

// For local development, we'll still use SQLite
export { db as localDb } from './db';
