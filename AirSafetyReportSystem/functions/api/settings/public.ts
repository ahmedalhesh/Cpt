async function getOrCreateSettings(env: any) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS company_settings (id TEXT PRIMARY KEY, company_name TEXT, logo TEXT, email TEXT, phone TEXT, address TEXT, created_at TEXT, updated_at TEXT)').run();
  let row = await env.DB.prepare('SELECT * FROM company_settings LIMIT 1').first();
  if (!row) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO company_settings (id, company_name, logo, email, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, 'Report Sys', null, null, null, null, now, now).run();
    row = await env.DB.prepare('SELECT * FROM company_settings WHERE id = ?').bind(id).first();
  }
  return row;
}

export const onRequestGet = async ({ env }: { env: any }) => {
  try {
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

