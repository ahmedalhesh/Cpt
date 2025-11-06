import { resolveUserId } from '../lib/auth';

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Resolve user using secure JWT verification
    const userId = await resolveUserId(request, env);
    let userRole: string | null = null;

    if (userId) {
      const result = await env.DB.prepare('SELECT role FROM users WHERE id = ? LIMIT 1').bind(userId).first();
      if (result) {
        userRole = result.role as string;
      }
    }

    const whereClause = () => (userRole !== 'admin' && userId) ? `WHERE submitted_by = ?` : '';
    const paramsFor = (): any[] => (userRole !== 'admin' && userId) ? [userId] : [];

    // Totals by table
    async function countTable(table: string) {
      const where = whereClause();
      const row = await env.DB.prepare(`SELECT COUNT(*) as total FROM ${table} ${where}`).bind(...paramsFor()).first();
      return Number(row?.total || 0);
    }

    const total = (await Promise.all([
      countTable('asr_reports'),
      countTable('ncr_reports'),
      countTable('or_reports'),
      countTable('rir_reports'),
      countTable('cdf_reports'),
      countTable('chr_reports'),
      countTable('captain_reports'),
    ])).reduce((a, b) => a + b, 0);

    // By status helper
    async function statusMap(table: string) {
      const where = whereClause();
      const rows = await env.DB.prepare(`SELECT status, COUNT(*) as cnt FROM ${table} ${where} GROUP BY status`).bind(...paramsFor()).all();
      const map: Record<string, number> = {};
      for (const row of rows.results || []) { map[String(row.status || '').toLowerCase()] = Number(row.cnt || 0); }
      return map;
    }

    const emptyStatus: Record<string, number> = { submitted: 0, in_review: 0, closed: 0, rejected: 0 };
    const allStatus = await Promise.all([
      statusMap('asr_reports'),
      statusMap('ncr_reports'),
      statusMap('or_reports'),
      statusMap('rir_reports'),
      statusMap('cdf_reports'),
      statusMap('chr_reports'),
      statusMap('captain_reports'),
    ]);
    const byStatus = { ...emptyStatus };
    for (const m of allStatus) {
      for (const k of Object.keys(m)) { if (k in byStatus) byStatus[k] += m[k]; }
    }

    // By type
    const byType: Record<string, number> = { asr: 0, ncr: 0, or: 0, rir: 0, cdf: 0, chr: 0, captain: 0 };
    byType.asr = await countTable('asr_reports');
    byType.ncr = await countTable('ncr_reports');
    byType.or = await countTable('or_reports');
    byType.rir = await countTable('rir_reports');
    byType.cdf = await countTable('cdf_reports');
    byType.chr = await countTable('chr_reports');
    byType.captain = await countTable('captain_reports');

    return new Response(JSON.stringify({ total, byStatus, byType }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('GET /api/reports/stats error:', error);
    return new Response(JSON.stringify({ message: 'Failed to fetch stats', error: error?.message || String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
