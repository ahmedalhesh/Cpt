import { resolveUserId } from './lib/auth';

async function getOrCreateSettings(env: any) {
  let row = await env.DB.prepare('SELECT * FROM company_settings LIMIT 1').first();
  if (!row) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS company_settings (id TEXT PRIMARY KEY, company_name TEXT, logo TEXT, email TEXT, phone TEXT, address TEXT, created_at TEXT, updated_at TEXT)')
      .run();
    await env.DB.prepare('INSERT INTO company_settings (id, company_name, logo, email, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, 'Report Sys', null, null, null, null, now, now).run();
    row = await env.DB.prepare('SELECT * FROM company_settings WHERE id = ?').bind(id).first();
  }
  return row;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const userId = await resolveUserId(request, env);
    if (!userId) return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const row = await getOrCreateSettings(env);
    const data = {
      id: row.id,
      companyName: row.company_name,
      logo: row.logo,
      email: row.email,
      phone: row.phone,
      address: row.address,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: 'Failed to get settings', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const onRequestPut = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const userId = await resolveUserId(request, env);
    if (!userId) return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const body = await request.json();
    const row = await getOrCreateSettings(env);
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE company_settings SET company_name = ?, logo = ?, email = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?')
      .bind(body.companyName ?? row.company_name, body.logo ?? row.logo, body.email ?? row.email, body.phone ?? row.phone, body.address ?? row.address, now, row.id)
      .run();
    const updated = await env.DB.prepare('SELECT * FROM company_settings WHERE id = ?').bind(row.id).first();
    const data = {
      id: updated.id,
      companyName: updated.company_name,
      logo: updated.logo,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: 'Failed to update settings', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

