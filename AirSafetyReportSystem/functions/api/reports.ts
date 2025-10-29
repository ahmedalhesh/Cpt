/**
 * /api/reports - Create report (POST)
 * Cloudflare Pages Function using D1 + Drizzle
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../shared/schema';

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = decodeJwtPayload(token);
    const userId = payload?.id;
    if (!userId) {
      return new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();

    // Apply defaults and normalize
    const data: any = {
      ...body,
      reportType: body?.reportType ?? 'asr',
      status: body?.status ?? 'submitted',
      isAnonymous: body?.isAnonymous ? 1 : 0,
      description: body?.description ?? '',
      submittedBy: userId,
      extraData: typeof body?.extraData === 'string' ? body.extraData : JSON.stringify(body?.extraData ?? {}),
    };

    // Generate id to avoid RETURNING support issues in D1
    const id = (globalThis as any).crypto?.randomUUID?.() || (Math.random().toString(36).slice(2) + Date.now());

    const db = drizzle(env.DB, { schema });

    await db.insert(schema.reports).values({ id, ...data } as any);

    return new Response(JSON.stringify({ id, ...data }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: 'Failed to create report', error: error?.message || String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
