export const onRequestPatch = async ({ request, env, params }: { request: Request; env: any; params: any }) => {
  try {
    const id = params?.id || new URL(request.url).pathname.split('/').slice(-2, -1)[0];
    const { status } = await request.json();
    if (!id || !status) {
      return new Response(JSON.stringify({ message: 'id and status are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const tables = ['asr_reports','ncr_reports','or_reports','rir_reports','cdf_reports','chr_reports','captain_reports'];
    let tableFound: string | null = null;
    let updated = 0;
    for (const t of tables) {
      const res = await env.DB.prepare(`UPDATE ${t} SET status = ?, updated_at = ? WHERE id = ?`).bind(status, new Date().toISOString(), id).run();
      if ((res.meta as any)?.changes > 0) { updated += (res.meta as any).changes; tableFound = t; break; }
    }

    if (!updated) {
      return new Response(JSON.stringify({ message: 'Report not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Notify submitter about status change
    try {
      // resolve submitter id
      if (tableFound) {
        const row = await env.DB.prepare(`SELECT submitted_by FROM ${tableFound} WHERE id = ? LIMIT 1`).bind(id).first();
        const submitterId = row?.submitted_by as string | undefined;
        if (submitterId) {
          await ensureNotificationsTable(env);
          const now = new Date().toISOString();
          const titles: Record<string, string> = {
            in_review: 'Report Under Review',
            closed: 'Report Approved & Closed',
            rejected: 'Report Rejected',
          };
          const messages: Record<string, string> = {
            in_review: 'Your report status changed to In Review.',
            closed: 'Your report has been approved and closed.',
            rejected: 'Your report has been rejected.',
          };
          const title = titles[status] || 'Report Status Updated';
          const message = messages[status] || `Your report status changed to ${status}.`;
          const notifId = crypto.randomUUID();
          await env.DB.prepare('INSERT INTO notifications (id, user_id, title, message, type, is_read, related_report_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(notifId, submitterId, title, message, 'info', 0, id, now, now).run();
          await logNotificationAudit(env, { eventType: 'status_notify', targetUserId: submitterId, relatedReportId: id, notificationId: notifId, message: `Status -> ${status}` });
        }
      }
    } catch {}

    return new Response(JSON.stringify({ id, status }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: 'Failed to update status', error: error?.message || String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
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
      .bind(crypto.randomUUID(), payload.eventType, payload.userId || null, payload.targetUserId || null, payload.relatedReportId || null, payload.notificationId || null, payload.message || null, payload.meta ? JSON.stringify(payload.meta) : null).run();
  } catch {}
}

