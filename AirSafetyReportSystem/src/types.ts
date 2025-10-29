/**
 * Type definitions for Cloudflare Workers environment
 */

export interface Env {
	DB: D1Database;
	__STATIC_CONTENT: KVNamespace;
	__STATIC_CONTENT_MANIFEST: string;
	NODE_ENV?: string;
}

export interface AuthUser {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	role: string;
}

