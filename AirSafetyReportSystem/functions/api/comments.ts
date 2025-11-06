import { resolveUserId } from './lib/auth';
import { sanitizeString, commonSchemas } from './lib/validation';
import { z } from 'zod';

// Comment schema
const commentSchema = z.object({
  reportId: commonSchemas.reportId,
  content: z.string().min(1).max(10000),
});

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Parse and validate request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ message: 'Invalid request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = commentSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          message: 'Invalid comment data',
          errors: validation.error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { reportId, content } = validation.data;

    // Sanitize content
    const sanitizedContent = sanitizeString(content);
    if (!sanitizedContent) {
      return new Response(
        JSON.stringify({ message: 'Comment content cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolve user id using secure JWT verification
    let userId: string | null = await resolveUserId(request, env);
    
    // Fallback to admin/demo only in development
    const isDevelopment = env.NODE_ENV !== 'production' && env.NODE_ENV !== 'PRODUCTION';
    if (!userId && isDevelopment) {
      const r = await env.DB.prepare('SELECT id FROM users WHERE email IN (?, ?) ORDER BY role = "admin" DESC LIMIT 1').bind('admin@airline.com','demo@airline.com').first();
      userId = r?.id || null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO comments (id, report_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, reportId, userId, sanitizedContent, now).run();

    // Create notifications: notify admins and the report submitter (if not the commenter)
    await notifyOnNewComment(env, { reportId, commenterId: userId, commentId: id });

    return new Response(JSON.stringify({ id, reportId, userId, content: sanitizedContent, createdAt: now }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Comment creation error:', error);
    return new Response(
      JSON.stringify({ message: 'Failed to add comment. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function notifyOnNewComment(env: any, data: { reportId: string; commenterId: string; commentId: string }) {
  try {
    // Resolve report submitter across tables
    const tables = ['asr_reports','ncr_reports','or_reports','rir_reports','cdf_reports','chr_reports','captain_reports'];
    let submittedBy: string | null = null;
    for (const t of tables) {
      const r = await env.DB.prepare(`SELECT submitted_by as s FROM ${t} WHERE id = ? LIMIT 1`).bind(data.reportId).first();
      if (r && r.s) { submittedBy = String(r.s); break; }
    }

    const now = new Date().toISOString();

    // Notify admins (except the commenter)
    await ensureNotificationsTable(env);
    const admins = await env.DB.prepare('SELECT id FROM users WHERE lower(role) = "admin"').all();
    for (const a of (admins.results || [])) {
      if (a.id === data.commenterId) continue;
      const notifId = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO notifications (id, user_id, title, message, type, is_read, related_report_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(notifId, a.id, 'New Comment', 'A new comment was added to a report you oversee.', 'info', 0, data.reportId, now, now).run();
      await logNotificationAudit(env, {
        eventType: 'new_comment_notify_admin',
        userId: data.commenterId,
        targetUserId: a.id,
        relatedReportId: data.reportId,
        notificationId: notifId,
        message: 'Notify admin about new comment',
      });
    }

    // Notify report submitter (if exists and not the commenter)
    if (submittedBy && submittedBy !== data.commenterId) {
      const notifId2 = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO notifications (id, user_id, title, message, type, is_read, related_report_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(notifId2, submittedBy, 'New Comment on Your Report', 'A new comment was added to your report.', 'info', 0, data.reportId, now, now).run();
      await logNotificationAudit(env, {
        eventType: 'new_comment_notify_submitter',
        userId: data.commenterId,
        targetUserId: submittedBy,
        relatedReportId: data.reportId,
        notificationId: notifId2,
        message: 'Notify submitter about new comment',
      });
    }
  } catch (e) {
    console.log('[notifyOnNewComment] failed:', e?.message || String(e));
  }
}

async function logNotificationAudit(env: any, payload: { eventType: string; userId?: string; targetUserId?: string; relatedReportId?: string | null; notificationId?: string | null; message?: string; meta?: any }) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS notification_audit (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id TEXT,
      target_user_id TEXT,
      related_report_id TEXT,
      notification_id TEXT,
      message TEXT,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run();

    await env.DB.prepare('INSERT INTO notification_audit (id, event_type, user_id, target_user_id, related_report_id, notification_id, message, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(
        crypto.randomUUID(),
        payload.eventType,
        payload.userId || null,
        payload.targetUserId || null,
        payload.relatedReportId || null,
        payload.notificationId || null,
        payload.message || null,
        payload.meta ? JSON.stringify(payload.meta) : null,
      ).run();
  } catch {}
}

async function ensureNotificationsTable(env: any) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      related_report_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`).run();
    const fk = await env.DB.prepare(`PRAGMA foreign_key_list('notifications')`).all();
    const hasReportsFk = (fk.results || []).some((r: any) => String(r.table || '').toLowerCase() === 'reports');
    if (hasReportsFk) {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS notifications_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        is_read INTEGER NOT NULL DEFAULT 0,
        related_report_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`).run();
      await env.DB.prepare(`INSERT INTO notifications_new (id, user_id, title, message, type, is_read, related_report_id, created_at, updated_at)
        SELECT id, user_id, title, message, COALESCE(type,'info'), COALESCE(is_read,0), related_report_id, created_at, updated_at FROM notifications`).run();
      await env.DB.prepare(`DROP TABLE notifications`).run();
      await env.DB.prepare(`ALTER TABLE notifications_new RENAME TO notifications`).run();
    }
  } catch {}
}

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');
    if (!reportId) {
      return new Response(JSON.stringify({ message: 'reportId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const sql = `SELECT c.*, u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name, u.role as user_role FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.report_id = ? ORDER BY c.created_at ASC`;
    const res = await env.DB.prepare(sql).bind(reportId).all();
    const items = (res.results || []).map((row: any) => ({ id: row.id, reportId: row.report_id, userId: row.user_id, content: row.content, createdAt: row.created_at, user: { id: row.user_id, email: row.user_email, firstName: row.user_first_name, lastName: row.user_last_name, role: row.user_role } }));
    return new Response(JSON.stringify(items), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: 'Failed to fetch comments', error: error?.message || String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

