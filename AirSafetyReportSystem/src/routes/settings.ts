/**
 * Settings routes for Cloudflare Workers
 */

import type { Env } from '../types';
import { D1Storage } from '../storage';
import { requireAuth, requireRole } from '../auth';

export async function settingsRoutes(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	const storage = new D1Storage(env.DB);

	try {
		// Get public settings
		if (path === '/api/settings/public' && method === 'GET') {
			const settings = await storage.getCompanySettings();
			return new Response(JSON.stringify(settings), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Get settings (admin only)
		if (path === '/api/settings' && method === 'GET') {
			const user = await requireAuth(request, env);
			requireRole(user, ['admin']);
			const settings = await storage.getCompanySettings();
			return new Response(JSON.stringify(settings), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Update settings (admin only)
		if (path === '/api/settings' && method === 'PATCH') {
			const user = await requireAuth(request, env);
			requireRole(user, ['admin']);
			const body = await request.json();
			const settings = await storage.updateCompanySettings(body);
			return new Response(JSON.stringify(settings), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Delete logo (admin only)
		if (path === '/api/settings/logo' && method === 'DELETE') {
			const user = await requireAuth(request, env);
			requireRole(user, ['admin']);
			await storage.deleteCompanyLogo();
			return new Response(JSON.stringify({ message: 'Logo deleted' }), {
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

		console.error('Settings route error:', error);
		return new Response(
			JSON.stringify({ message: 'Internal server error', error: error.message }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}

