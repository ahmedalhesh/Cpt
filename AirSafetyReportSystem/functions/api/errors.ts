export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const headers = request.headers;
    const userAgent = headers.get('User-Agent') || '';
    const referer = headers.get('Referer') || '';
    const ip = headers.get('CF-Connecting-IP') || '';

    const payload = {
      id,
      timestamp: now,
      level: body.level || 'error',
      message: String(body.message || ''),
      stack: String(body.stack || ''),
      path: body.path || new URL(request.url).pathname,
      method: body.method || (request as any).method || 'POST',
      status: Number(body.status || 0) || null,
      user_id: body.userId || null,
      user_email: body.userEmail || null,
      user_agent: userAgent,
      referer,
      ip,
      env: env.NODE_ENV || 'production',
    } as const;

    await env.DB.prepare(
      `INSERT INTO error_logs (id, timestamp, level, message, stack, path, method, status, user_id, user_email, user_agent, referer, ip, env) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.id,
      payload.timestamp,
      payload.level,
      payload.message,
      payload.stack,
      payload.path,
      payload.method,
      payload.status,
      payload.user_id,
      payload.user_email,
      payload.user_agent,
      payload.referer,
      payload.ip,
      payload.env
    ).run();

    return new Response(JSON.stringify({ ok: true, id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
    const sql = `SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ?`;
    const res = await env.DB.prepare(sql).bind(limit).all();
    return new Response(JSON.stringify(res.results || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
