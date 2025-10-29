/**
 * Router for Cloudflare Workers
 * Converts Express-style routes to Fetch API
 */

import type { Env } from './types';
import { authRoutes } from './routes/auth';
import { reportRoutes } from './routes/reports';
import { commentRoutes } from './routes/comments';
import { notificationRoutes } from './routes/notifications';
import { userRoutes } from './routes/users';
import { settingsRoutes } from './routes/settings';

export const router = {
	async handle(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		if (method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			let response: Response;

			// Auth routes
			if (path.startsWith('/api/auth')) {
				response = await authRoutes(request, env);
			}
			// Report routes
			else if (path.startsWith('/api/reports')) {
				response = await reportRoutes(request, env);
			}
			// Comment routes
			else if (path.startsWith('/api/comments')) {
				response = await commentRoutes(request, env);
			}
			// Notification routes
			else if (path.startsWith('/api/notifications')) {
				response = await notificationRoutes(request, env);
			}
			// User routes
			else if (path.startsWith('/api/users')) {
				response = await userRoutes(request, env);
			}
			// Settings routes
			else if (path.startsWith('/api/settings')) {
				response = await settingsRoutes(request, env);
			}
			// 404 for unknown API routes
			else {
				response = new Response(
					JSON.stringify({ message: 'Not Found' }),
					{ status: 404, headers: { 'Content-Type': 'application/json' } }
				);
			}

			// Add CORS headers to response
			Object.entries(corsHeaders).forEach(([key, value]) => {
				response.headers.set(key, value);
			});

			return response;
		} catch (error) {
			console.error('Router error:', error);
			return new Response(
				JSON.stringify({
					message: 'Internal server error',
					error: error instanceof Error ? error.message : 'Unknown error',
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					},
				}
			);
		}
	},
};

