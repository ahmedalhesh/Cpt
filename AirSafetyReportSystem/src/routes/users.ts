/**
 * User management routes for Cloudflare Workers
 */

import type { Env } from '../types';
import { D1Storage } from '../storage';
import { requireAuth, requireRole } from '../auth';
import { hashPassword } from '../auth';

export async function userRoutes(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	const storage = new D1Storage(env.DB);

	try {
		const user = await requireAuth(request, env);

		// Get all users (admin only)
		if (path === '/api/users' && method === 'GET') {
			requireRole(user, ['admin']);
			const users = await storage.getAllUsers();
			return new Response(JSON.stringify(users), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Create user (admin only)
		if (path === '/api/users' && method === 'POST') {
			requireRole(user, ['admin']);
			const body = await request.json() as any;

			// Check for duplicate email
			if (body.email) {
				const existingUser = await storage.getUserByEmail(body.email);
				if (existingUser) {
					return new Response(
						JSON.stringify({ message: 'Email already exists' }),
						{ status: 400, headers: { 'Content-Type': 'application/json' } }
					);
				}
			}

			// Check for duplicate name
			if (body.firstName && body.lastName) {
				const existingUser = await storage.getUserByName(body.firstName, body.lastName);
				if (existingUser) {
					return new Response(
						JSON.stringify({ message: 'A user with this name already exists' }),
						{ status: 400, headers: { 'Content-Type': 'application/json' } }
					);
				}
			}

			const hashedPassword = body.password ? await hashPassword(body.password) : null;
			const newUser = await storage.createUser({
				...body,
				password: hashedPassword,
			});

			return new Response(JSON.stringify(newUser), {
				status: 201,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Update user
		if (path.startsWith('/api/users/') && method === 'PATCH') {
			const id = path.split('/')[3];
			
			// Only admin or the user themselves can update
			if (user.role !== 'admin' && user.id !== id) {
				return new Response(
					JSON.stringify({ message: 'Access denied' }),
					{ status: 403, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const body = await request.json() as any;

			// Check for duplicate email
			if (body.email) {
				const existingUser = await storage.getUserByEmail(body.email);
				if (existingUser && existingUser.id !== id) {
					return new Response(
						JSON.stringify({ message: 'Email already exists' }),
						{ status: 400, headers: { 'Content-Type': 'application/json' } }
					);
				}
			}

			// Check for duplicate name
			if (body.firstName && body.lastName) {
				const existingUser = await storage.getUserByName(body.firstName, body.lastName);
				if (existingUser && existingUser.id !== id) {
					return new Response(
						JSON.stringify({ message: 'A user with this name already exists' }),
						{ status: 400, headers: { 'Content-Type': 'application/json' } }
					);
				}
			}

			const updateData: any = { ...body };
			if (body.password) {
				updateData.password = await hashPassword(body.password);
			}

			const updatedUser = await storage.updateUser(id, updateData);
			return new Response(JSON.stringify(updatedUser), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Delete user (admin only)
		if (path.startsWith('/api/users/') && method === 'DELETE') {
			requireRole(user, ['admin']);
			const id = path.split('/')[3];
			await storage.deleteUser(id);
			return new Response(JSON.stringify({ message: 'User deleted' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Reset password (admin only)
		if (path.startsWith('/api/users/') && path.endsWith('/reset-password') && method === 'PATCH') {
			requireRole(user, ['admin']);
			const id = path.split('/')[3];
			const body = await request.json() as { password?: string };

			if (!body.password) {
				return new Response(
					JSON.stringify({ message: 'Password is required' }),
					{ status: 400, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const hashedPassword = await hashPassword(body.password);
			await storage.updateUserPassword(id, hashedPassword);

			return new Response(JSON.stringify({ message: 'Password reset successfully' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(
			JSON.stringify({ message: 'Not Found' }),
			{ status: 404, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error: any) {
		if (error.message === 'Authentication required') {
			return new Response(
				JSON.stringify({ message: 'Authentication required' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}
		if (error.message === 'Insufficient permissions') {
			return new Response(
				JSON.stringify({ message: 'Insufficient permissions' }),
				{ status: 403, headers: { 'Content-Type': 'application/json' } }
			);
		}

		console.error('User route error:', error);
		return new Response(
			JSON.stringify({ message: 'Internal server error', error: error.message }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}

