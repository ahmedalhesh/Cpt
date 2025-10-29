/**
 * Comment routes for Cloudflare Workers
 */

import type { Env } from '../types';
import { D1Storage } from '../storage';
import { requireAuth } from '../auth';
import { insertCommentSchema } from '@shared/schema';

export async function commentRoutes(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	const storage = new D1Storage(env.DB);

	try {
		// Get comments for a report
		if (path === '/api/comments' && method === 'GET') {
			const user = await requireAuth(request, env);
			const reportId = url.searchParams.get('reportId');

			if (!reportId) {
				return new Response(
					JSON.stringify({ message: 'Report ID is required' }),
					{ status: 400, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const comments = await storage.getCommentsByReportId(reportId);
			return new Response(JSON.stringify(comments), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Create comment
		if (path === '/api/comments' && method === 'POST') {
			const user = await requireAuth(request, env);
			const body = await request.json() as any;

			const validatedData = insertCommentSchema.parse({
				...body,
				userId: user.id,
			});

			const comment = await storage.createComment(validatedData);

			if (comment && body.reportId) {
				await storage.createCommentAddedNotification(
					body.reportId,
					user.id,
					comment.content || ''
				);
			}

			return new Response(JSON.stringify(comment), {
				status: 201,
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

		console.error('Comment route error:', error);
		return new Response(
			JSON.stringify({ message: 'Internal server error', error: error.message }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}

