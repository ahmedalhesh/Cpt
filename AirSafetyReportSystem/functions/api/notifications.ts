import { resolveUserId } from './lib/auth';

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const userId = await resolveUserId(request, env);
    if (!userId) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const res = await env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
      .bind(userId).all();
    const list = res.results || [];
    // Normalize field names to camelCase for the client
    const mapped = list.map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      message: n.message,
      type: n.type || 'info',
      isRead: n.is_read === 1 || n.is_read === true,
      relatedReportId: n.related_report_id || null,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));
    return new Response(JSON.stringify(mapped), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: 'Failed to fetch notifications', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const onRequestDelete = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const userId = await resolveUserId(request, env);
    if (!userId) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    await env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(userId).run();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: 'Failed to delete notifications', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

