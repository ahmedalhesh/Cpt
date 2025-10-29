/**
 * Authentication utilities for Cloudflare Workers
 * Adapted from server/auth.ts
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Env, AuthUser } from './types';
import { D1Storage } from './storage';

const JWT_SECRET = 'your-secret-key-change-in-production'; // Should use env var
const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
	userId: string;
	email: string;
	role: string;
	iat?: number;
	exp?: number;
}

export function generateToken(user: AuthUser): string {
	return jwt.sign(
		{
			userId: user.id,
			email: user.email,
			role: user.role,
		},
		JWT_SECRET,
		{ expiresIn: JWT_EXPIRES_IN }
	);
}

export function verifyToken(token: string): JWTPayload | null {
	try {
		return jwt.verify(token, JWT_SECRET) as JWTPayload;
	} catch (error) {
		return null;
	}
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
	return bcrypt.compare(password, hashedPassword);
}

/**
 * Extract and verify JWT token from request
 */
export async function getAuthUser(request: Request, env: Env): Promise<AuthUser | null> {
	const authHeader = request.headers.get('authorization');
	
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	const token = authHeader.substring(7);
	const payload = verifyToken(token);

	if (!payload) {
		return null;
	}

	// Get user from database
	const storage = new D1Storage(env.DB);
	const user = await storage.getUser(payload.userId);
	
	if (!user) {
		return null;
	}

	return {
		id: user.id || '',
		email: user.email || '',
		firstName: user.firstName || undefined,
		lastName: user.lastName || undefined,
		role: user.role || 'captain',
	};
}

/**
 * Check if user is authenticated
 */
export async function requireAuth(request: Request, env: Env): Promise<AuthUser> {
	const user = await getAuthUser(request, env);
	if (!user) {
		throw new Error('Authentication required');
	}
	return user;
}

/**
 * Check if user has required role
 */
export function requireRole(user: AuthUser, allowedRoles: string[]): void {
	if (!allowedRoles.includes(user.role)) {
		throw new Error('Insufficient permissions');
	}
}

