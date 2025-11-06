async function resolveUserId(request: Request, env: any) {
  const auth = request.headers.get('Authorization');
  const hasBearer = !!auth && auth.startsWith('Bearer ');
  if (!hasBearer) return null;
  const token = auth!.replace('Bearer ', '');
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    let userId: string | null = payload?.id ?? null;
    if (!userId && payload?.email) {
      const r = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(payload.email).first();
      if (r) userId = r.id as string;
    }
    return userId;
  } catch { return null; }
}

export const onRequestPatch = async ({ request, env, params }: { request: Request; env: any; params: any }) => {
  try {
    const userId = await resolveUserId(request, env);
    if (!userId) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const id = params?.id || new URL(request.url).pathname.split('/').slice(-2, -1)[0];
    if (!id) return new Response(JSON.stringify({ ok: false, message: 'Notification id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    await env.DB.prepare('UPDATE notifications SET is_read = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').bind(id, userId).run();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: 'Failed to mark as read', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};


