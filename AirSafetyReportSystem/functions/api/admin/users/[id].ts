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

export const onRequestPut = async ({ request, env, params }: { request: Request; env: any; params: any }) => {
  try {
    // Check authentication
    const authCheck = await checkAdminAuth(request, env);
    if (!authCheck.ok) {
      return authCheck.error!;
    }

    const id = params?.id || new URL(request.url).pathname.split('/').pop();
    const body = await request.json();
    if (!id) return new Response(JSON.stringify({ message: 'id is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    // Email uniqueness if changed
    if (body?.email) {
      const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1').bind(body.email, id).first();
      if (exists) {
        return new Response(JSON.stringify({ message: 'Email already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE users SET email = COALESCE(?, email), first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), role = COALESCE(?, role), updated_at = ? WHERE id = ?')
      .bind(body.email ?? null, body.firstName ?? null, body.lastName ?? null, body.role ?? null, now, id)
      .run();

    const row = await env.DB.prepare('SELECT id, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?').bind(id).first();
    const user = { id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name, role: row.role, createdAt: row.created_at, updatedAt: row.updated_at };
    return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: 'Failed to update user', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const onRequestDelete = async ({ request, env, params }: { request: Request; env: any; params: any }) => {
  try {
    // Check authentication
    const authCheck = await checkAdminAuth(request, env);
    if (!authCheck.ok) {
      return authCheck.error!;
    }

    const id = params?.id || new URL(request.url).pathname.split('/').pop();
    if (!id) return new Response(JSON.stringify({ message: 'id is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    // Check if user exists
    const userRow = await env.DB.prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1').bind(id).first();
    if (!userRow) {
      return new Response(JSON.stringify({ message: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Prevent deleting yourself
    const auth = request.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.substring(7);
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1];
          const decoded = atob(payloadBase64);
          const payload = JSON.parse(decoded);
          if (payload.id === id) {
            return new Response(JSON.stringify({ message: 'Cannot delete your own account' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
        }
      } catch (e) {
        // If token parsing fails, continue with deletion (shouldn't happen due to auth check)
      }
    }

    // Delete related data first (in transaction-like order)
    // Delete notifications first (they reference users)
    try {
      await env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(id).run();
    } catch (e: any) {
      console.warn('Error deleting notifications:', e?.message);
      // Continue even if this fails
    }
    
    // Delete comments (they reference users)
    try {
      await env.DB.prepare('DELETE FROM comments WHERE user_id = ?').bind(id).run();
    } catch (e: any) {
      console.warn('Error deleting comments:', e?.message);
      // Continue even if this fails
    }
    
    // Get all report IDs that reference this user from all report tables
    const reportTables = ['asr_reports', 'ncr_reports', 'or_reports', 'rir_reports', 'cdf_reports', 'chr_reports', 'captain_reports'];
    const allReportIds: string[] = [];
    
    for (const table of reportTables) {
      try {
        const reports = await env.DB.prepare(`SELECT id FROM ${table} WHERE submitted_by = ?`).bind(id).all();
        if (reports.results) {
          allReportIds.push(...(reports.results.map((r: any) => r.id)));
        }
      } catch (e: any) {
        console.warn(`Error fetching reports from ${table}:`, e?.message);
        // Continue with other tables
      }
    }
    
    // Delete comments and attachments for these reports
    if (allReportIds.length > 0) {
      try {
        // Delete comments for reports (by report_id)
        for (const reportId of allReportIds) {
          try {
            await env.DB.prepare('DELETE FROM comments WHERE report_id = ?').bind(reportId).run();
          } catch (e: any) {
            console.warn(`Error deleting comments for report ${reportId}:`, e?.message);
          }
        }
      } catch (e: any) {
        console.warn('Error deleting comments for reports:', e?.message);
      }
      
      try {
        // Delete attachments for reports
        for (const reportId of allReportIds) {
          try {
            await env.DB.prepare('DELETE FROM attachments WHERE report_id = ?').bind(reportId).run();
          } catch (e: any) {
            console.warn(`Error deleting attachments for report ${reportId}:`, e?.message);
          }
        }
      } catch (e: any) {
        console.warn('Error deleting attachments for reports:', e?.message);
      }
    }
    
    // Delete the reports themselves
    for (const table of reportTables) {
      try {
        await env.DB.prepare(`DELETE FROM ${table} WHERE submitted_by = ?`).bind(id).run();
      } catch (e: any) {
        console.warn(`Error deleting reports from ${table}:`, e?.message);
        // Continue with other tables
      }
    }
    
    // Finally, delete the user
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    
    return new Response(JSON.stringify({ ok: true, message: 'User and related data deleted successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Delete user error:', e);
    return new Response(JSON.stringify({ message: 'Failed to delete user', error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
