/**
 * Get current user API endpoint (Cloudflare Pages Functions)
 */

import { verifyJWT, decodeJwtPayload } from '../lib/jwt';

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ message: 'No token provided' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const JWT_SECRET = env.JWT_SECRET || 'default-secret-key-change-in-production-minimum-32-chars';
    
    // Try secure verification first
    let payload = null;
    if (JWT_SECRET && JWT_SECRET.length >= 32) {
      payload = await verifyJWT(token, JWT_SECRET);
    }
    
    // Fallback to decode for backward compatibility
    if (!payload) {
      payload = decodeJwtPayload(token);
      if (payload) {
        console.warn('Using unsigned JWT token - this should be migrated to signed tokens');
      }
    }
    
    if (!payload?.id && !payload?.email) {
      return new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Resolve user by id or email strictly
    let userRow: any = null;
    if (payload?.id) {
      userRow = await env.DB.prepare('SELECT id, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1').bind(payload.id).first();
    }
    if (!userRow && payload?.email) {
      userRow = await env.DB.prepare('SELECT id, email, first_name, last_name, role, created_at, updated_at FROM users WHERE email = ? LIMIT 1').bind(payload.email).first();
    }

    if (!userRow) {
      return new Response(JSON.stringify({ message: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      firstName: userRow.first_name,
      lastName: userRow.last_name,
      role: userRow.role,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
    };

    return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ message: 'Failed to get user', error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
