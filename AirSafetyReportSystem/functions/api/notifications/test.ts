async function resolveUserIdFromRequestOrQuery(request: Request, env: any) {
  // Try Authorization header first
  const auth = request.headers.get('Authorization');
  const hasBearer = !!auth && auth.startsWith('Bearer ');
  let token = hasBearer ? auth!.replace('Bearer ', '') : '';

  // Fallback: token via query param ?t=...
  if (!token) {
    const url = new URL(request.url);
    token = url.searchParams.get('t') || '';
  }

  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    let userId: string | null = payload?.id ?? null;
    if (!userId && payload?.email) {
      const r = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(payload.email).first();
      if (r) userId = r.id as string;
    }
    return userId;
  } catch {
    return null;
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const userId = await resolveUserIdFromRequestOrQuery(request, env);
    if (!userId) return new Response(JSON.stringify({ ok: false, message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    await ensureNotificationsTable(env);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO notifications (id, user_id, title, message, type, is_read, related_report_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, userId, 'Test Notification', 'This is a test notification to verify wiring.', 'info', 0, null, now, now)
      .run();

    return new Response(JSON.stringify({ ok: true, id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: 'Failed to create test notification', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const onRequestGet = onRequestPost;

async function ensureNotificationsTable(env: any) {
  // Ensure table exists and has no foreign key dependency on 'reports'
  try {
    // Create if not exists (no FKs)
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

    // Detect old FK schema pointing to 'reports'
    const fk = await env.DB.prepare(`PRAGMA foreign_key_list('notifications')`).all();
    const hasReportsFk = (fk.results || []).some((r: any) => String(r.table || '').toLowerCase() === 'reports');
    if (hasReportsFk) {
      // Migrate: create new table without FK, copy, swap
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
