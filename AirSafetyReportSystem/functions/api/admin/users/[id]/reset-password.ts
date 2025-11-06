async function checkAdminAuth(request: Request, env: any): Promise<{ ok: boolean; error?: Response }> {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return { ok: false, error: new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
  }

  const token = auth.substring(7);
  let payload: any;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    const payloadBase64 = parts[1];
    const decoded = atob(payloadBase64);
    payload = JSON.parse(decoded);
  } catch (e) {
    return { ok: false, error: new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
  }

  const userId = payload.id;
  const userRow = await env.DB.prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1').bind(userId).first();
  
  if (!userRow) {
    return { ok: false, error: new Response(JSON.stringify({ message: 'User not found' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
  }

  const userRole = String(userRow.role || '').toLowerCase();
  if (userRole !== 'admin') {
    return { ok: false, error: new Response(JSON.stringify({ message: 'Forbidden: Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) };
  }

  return { ok: true };
}

export const onRequestPost = async ({ request, env, params }: { request: Request; env: any; params: any }) => {
  try {
    // Check authentication
    const authCheck = await checkAdminAuth(request, env);
    if (!authCheck.ok) {
      return authCheck.error!;
    }

    const id = params?.id || new URL(request.url).pathname.split('/').slice(-2, -1)[0];
    const { newPassword } = await request.json();
    if (!id || !newPassword) {
      return new Response(JSON.stringify({ message: 'id and newPassword are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Hash password using bcryptjs
    let hashedPassword = newPassword;
    try {
      const { hashSync } = await import('bcryptjs');
      hashedPassword = hashSync(String(newPassword), 10);
    } catch (bcryptError) {
      console.warn('bcryptjs not available, storing password as plain text');
      hashedPassword = String(newPassword);
    }

    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').bind(hashedPassword, now, id).run();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: 'Failed to reset password', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

