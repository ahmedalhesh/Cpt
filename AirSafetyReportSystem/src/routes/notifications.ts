/**
 * Notification routes for Cloudflare Workers
 */

import type { Env } from '../types';
import { D1Storage } from '../storage';
import { requireAuth } from '../auth';

export async function notificationRoutes(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	const storage = new D1Storage(env.DB);

	try {
		const user = await requireAuth(request, env);

		// Get all notifications
		if (path === '/api/notifications' && method === 'GET') {
			const notifications = await storage.getNotifications(user.id);
			return new Response(JSON.stringify(notifications), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Get unread count
		if (path === '/api/notifications/unread-count' && method === 'GET') {
			const count = await storage.getUnreadNotificationCount(user.id);
			return new Response(JSON.stringify(count), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Mark notification as read
		if (path.startsWith('/api/notifications/') && path.endsWith('/read') && method === 'PATCH') {
			const id = path.split('/')[3];
			const notification = await storage.markNotificationAsRead(id);
			return new Response(JSON.stringify(notification), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Mark all as read
		if (path === '/api/notifications/mark-all-read' && method === 'PATCH') {
			await storage.markAllNotificationsAsRead(user.id);
			return new Response(JSON.stringify({ message: 'All notifications marked as read' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Delete notification
		if (path.startsWith('/api/notifications/') && method === 'DELETE') {
			const id = path.split('/')[3];
			await storage.deleteNotification(id);
			return new Response(JSON.stringify({ message: 'Notification deleted' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Delete all notifications
		if (path === '/api/notifications' && method === 'DELETE') {
			await storage.deleteAllNotifications(user.id);
			return new Response(JSON.stringify({ message: 'All notifications deleted' }), {
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

		console.error('Notification route error:', error);
		return new Response(
			JSON.stringify({ message: 'Internal server error', error: error.message }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}

