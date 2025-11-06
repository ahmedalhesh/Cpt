/**
 * Cloudflare Pages Functions Middleware
 * Global CORS + error logging
 */

export const onRequest = async ({ request, env, waitUntil, next }: { request: Request; env: any; waitUntil: any; next: any }) => {
  // Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const res = await next();
    // Attach CORS
    try {
      res.headers.set('Access-Control-Allow-Origin', '*');
      res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    } catch {}

    // Log 5xx responses
    if (res.status >= 500) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const headers = request.headers;
      await env.DB.prepare(
        `INSERT INTO error_logs (id, timestamp, level, message, stack, path, method, status, user_agent, referer, ip, env) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        now,
        'error',
        `HTTP ${res.status} on ${new URL(request.url).pathname}`,
        '',
        new URL(request.url).pathname,
        (request as any).method || 'GET',
        res.status,
        headers.get('User-Agent') || '',
        headers.get('Referer') || '',
        headers.get('CF-Connecting-IP') || '',
        env.NODE_ENV || 'production'
      ).run();
    }

    return res;
  } catch (error: any) {
    // Log thrown error
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const headers = request.headers;
      await env.DB.prepare(
        `INSERT INTO error_logs (id, timestamp, level, message, stack, path, method, status, user_agent, referer, ip, env) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        now,
        'error',
        String(error?.message || error),
        String(error?.stack || ''),
        new URL(request.url).pathname,
        (request as any).method || 'GET',
        500,
        headers.get('User-Agent') || '',
        headers.get('Referer') || '',
        headers.get('CF-Connecting-IP') || '',
        env.NODE_ENV || 'production'
      ).run();
    } catch {}

    return new Response(JSON.stringify({ message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
};