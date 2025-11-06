/**
 * Authentication utilities for Cloudflare Pages Functions
 * Provides secure JWT verification with fallback for migration
 */

import { verifyJWT, decodeJwtPayload } from './jwt';

/**
 * Resolve user ID from JWT token
 * Tries secure verification first, falls back to decode for backward compatibility
 */
export async function resolveUserId(request: Request, env: any): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  const hasBearer = !!auth && auth.startsWith('Bearer ');
  if (!hasBearer) return null;
  
  const token = auth!.replace('Bearer ', '');
  const JWT_SECRET = env.JWT_SECRET || 'default-secret-key-change-in-production-minimum-32-chars';
  
  // Try secure verification first
  if (JWT_SECRET && JWT_SECRET.length >= 32) {
    const payload = await verifyJWT(token, JWT_SECRET);
    if (payload) {
      return payload.id || null;
    }
  }
  
  // Fallback to decode for backward compatibility (during migration)
  // This allows old unsigned tokens to work temporarily
  const decoded = decodeJwtPayload(token);
  if (decoded?.id) {
    console.warn('Using unsigned JWT token - this should be migrated to signed tokens');
    return decoded.id;
  }
  
  return null;
}


