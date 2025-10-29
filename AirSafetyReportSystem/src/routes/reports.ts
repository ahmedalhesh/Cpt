/**
 * Report routes for Cloudflare Workers
 * Simplified version - full implementation can be added
 */

import type { Env } from '../types';
import { D1Storage } from '../storage';
import { requireAuth, requireRole } from '../auth';
import { insertReportSchema } from '@shared/schema';

export async function reportRoutes(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	const storage = new D1Storage(env.DB);

	try {
		// Get all reports
		if (path === '/api/reports' && method === 'GET') {
			const user = await requireAuth(request, env);
			const params = url.searchParams;
			const type = params.get('type') || undefined;
			const status = params.get('status') || undefined;

			let reports;
			if (user.role === 'admin') {
				reports = await storage.getAllReports({ type, status });
			} else {
				reports = await storage.getUserReports(user.id, { type, status });
			}

			return new Response(JSON.stringify(reports), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Get report stats
		if (path === '/api/reports/stats' && method === 'GET') {
			const user = await requireAuth(request, env);
			const stats = user.role === 'admin'
				? await storage.getReportStats()
				: await storage.getUserReportStats(user.id);

			return new Response(JSON.stringify(stats), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Get single report
		if (path.startsWith('/api/reports/') && method === 'GET') {
			const user = await requireAuth(request, env);
			const id = path.split('/').pop();
			
			if (!id) {
				return new Response(
					JSON.stringify({ message: 'Report ID required' }),
					{ status: 400, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const report = await storage.getReport(id);
			if (!report) {
				return new Response(
					JSON.stringify({ message: 'Report not found' }),
					{ status: 404, headers: { 'Content-Type': 'application/json' } }
				);
			}

			// Check permissions
			if (user.role !== 'admin' && report.submitter.id !== user.id) {
				return new Response(
					JSON.stringify({ message: 'Access denied' }),
					{ status: 403, headers: { 'Content-Type': 'application/json' } }
				);
			}

			return new Response(JSON.stringify(report), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Create report
		if (path === '/api/reports' && method === 'POST') {
			const user = await requireAuth(request, env);
			const body = await request.json() as any;

			const reportData = {
				...body,
				reportType: body.reportType ?? 'asr',
				status: body.status ?? 'submitted',
				isAnonymous: body.isAnonymous ?? 0,
				description: body.description ?? '',
				submittedBy: user.id,
			};

			if (reportData.extraData && typeof reportData.extraData === 'object') {
				reportData.extraData = JSON.stringify(reportData.extraData);
			}

			const validatedData = insertReportSchema.parse(reportData);
			const reportDataForInsert = {
				...validatedData,
				reportType: validatedData.reportType ?? 'asr',
				status: validatedData.status ?? 'submitted',
				description: validatedData.description ?? '',
				submittedBy: validatedData.submittedBy ?? user.id,
				isAnonymous: validatedData.isAnonymous ?? 0,
			};

			const report = await storage.createReport(reportDataForInsert);

			if (report.status === 'submitted') {
				await storage.createReportSubmittedNotification(report.id, user.id);
			}

			return new Response(JSON.stringify(report), {
				status: 201,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Update report status
		if (path.startsWith('/api/reports/') && path.endsWith('/status') && method === 'PATCH') {
			const user = await requireAuth(request, env);
			requireRole(user, ['admin']);

			const id = path.split('/')[3];
			const body = await request.json() as { status?: string };
			const { status } = body;

			if (!status || !['submitted', 'in_review', 'closed', 'rejected', 'approved'].includes(status)) {
				return new Response(
					JSON.stringify({ message: 'Invalid status' }),
					{ status: 400, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const report = await storage.updateReportStatus(id, status);
			if (!report) {
				return new Response(
					JSON.stringify({ message: 'Report not found' }),
					{ status: 404, headers: { 'Content-Type': 'application/json' } }
				);
			}

			await storage.createReportStatusUpdatedNotification(report.id, report.submittedBy, status);

			return new Response(JSON.stringify(report), {
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

		console.error('Report route error:', error);
		return new Response(
			JSON.stringify({ message: 'Internal server error', error: error.message }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}

