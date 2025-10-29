/**
 * Authentication routes for Cloudflare Workers
 */

import type { Env } from '../types';
import { D1Storage } from '../storage';
import { generateToken, hashPassword, comparePassword } from '../auth';
import type { AuthUser } from '../types';

export async function authRoutes(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	const storage = new D1Storage(env.DB);

	// Login
	if (path === '/api/auth/login' && method === 'POST') {
		try {
			const body = await request.json() as { email?: string; password?: string };
			const { email, password } = body;

			if (!email || !password) {
				return new Response(
					JSON.stringify({ message: 'Email and password are required' }),
					{ status: 400, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const user = await storage.getUserByEmail(email);
			if (!user || !user.password) {
				return new Response(
					JSON.stringify({ message: 'Invalid email or password' }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const isValid = await comparePassword(password, user.password);
			if (!isValid) {
				return new Response(
					JSON.stringify({ message: 'Invalid email or password' }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const authUser: AuthUser = {
				id: user.id || '',
				email: user.email || '',
				firstName: user.firstName || undefined,
				lastName: user.lastName || undefined,
				role: user.role || 'captain',
			};

			const token = generateToken(authUser);

			return new Response(
				JSON.stringify({
					token,
					user: {
						id: authUser.id,
						email: authUser.email,
						firstName: authUser.firstName,
						lastName: authUser.lastName,
						role: authUser.role,
					},
				}),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		} catch (error) {
			console.error('Login error:', error);
			return new Response(
				JSON.stringify({ message: 'Internal server error' }),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			);
		}
	}

	// Get current user
	if (path === '/api/auth/user' && method === 'GET') {
		try {
			const authHeader = request.headers.get('authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return new Response(
					JSON.stringify({ message: 'Access token required' }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const token = authHeader.substring(7);
			const { verifyToken } = await import('../auth');
			const payload = verifyToken(token);

			if (!payload) {
				return new Response(
					JSON.stringify({ message: 'Invalid or expired token' }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const user = await storage.getUser(payload.userId);
			if (!user) {
				return new Response(
					JSON.stringify({ message: 'User not found' }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}

			return new Response(
				JSON.stringify({
					id: user.id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					role: user.role,
					profileImageUrl: user.profileImageUrl,
				}),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		} catch (error) {
			console.error('Get user error:', error);
			return new Response(
				JSON.stringify({ message: 'Internal server error' }),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			);
		}
	}

	return new Response(
		JSON.stringify({ message: 'Not Found' }),
		{ status: 404, headers: { 'Content-Type': 'application/json' } }
	);
}

