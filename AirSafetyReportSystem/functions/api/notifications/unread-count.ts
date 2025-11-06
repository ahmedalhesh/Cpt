import { resolveUserId } from '../lib/auth';

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const userId = await resolveUserId(request, env);
    if (!userId) return new Response(JSON.stringify(0), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const row = await env.DB.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND (is_read = 0 OR is_read IS NULL)').bind(userId).first();
    return new Response(JSON.stringify(Number(row?.cnt || 0)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify(0), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};

