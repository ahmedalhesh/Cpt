import { resolveUserId } from '../lib/auth';

export const onRequestPatch = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const userId = await resolveUserId(request, env);
    if (!userId) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    await env.DB.prepare('UPDATE notifications SET is_read = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').bind(userId).run();
    await logNotificationAudit(env, { eventType: 'mark_all_read', userId });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: 'Failed to mark all as read', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

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


