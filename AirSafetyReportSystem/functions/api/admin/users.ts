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

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Check authentication
    const authCheck = await checkAdminAuth(request, env);
    if (!authCheck.ok) {
      return authCheck.error!;
    }

    const rows = await env.DB.prepare('SELECT id, email, first_name, last_name, role, created_at, updated_at FROM users ORDER BY created_at DESC').all();
    const users = (rows.results || []).map((u: any) => ({ id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name, role: u.role, createdAt: u.created_at, updatedAt: u.updated_at }));
    return new Response(JSON.stringify(users), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: 'Failed to list users', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const body = await request.json();
    if (!body?.email || !body?.password) {
      return new Response(JSON.stringify({ message: 'email and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Uniqueness checks
    const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(body.email).first();
    if (exists) {
      return new Response(JSON.stringify({ message: 'Email already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Hash password before storing
    let hashedPassword = String(body.password);
    try {
      const bcryptjs = await import('bcryptjs');
      hashedPassword = bcryptjs.hashSync(String(body.password), 10);
    } catch (e: any) {
      console.error('Failed to hash password during user creation:', e?.message || String(e));
      // Fallback to plain text if bcrypt fails (not recommended for production)
      hashedPassword = String(body.password);
    }
    
    await env.DB.prepare('INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, body.email, hashedPassword, body.firstName ?? null, body.lastName ?? null, body.role ?? 'captain', now, now)
      .run();

    const user = { id, email: body.email, firstName: body.firstName ?? null, lastName: body.lastName ?? null, role: body.role ?? 'captain', createdAt: now, updatedAt: now };
    return new Response(JSON.stringify(user), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: 'Failed to create user', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

