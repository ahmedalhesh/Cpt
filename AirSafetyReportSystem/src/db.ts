/**
 * Database connection for Cloudflare D1
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@shared/schema';
import type { D1Database } from '@cloudflare/workers-types';

export function getDB(d1: D1Database) {
	return drizzle(d1, { schema });
}

