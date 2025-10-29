/**
 * /api/reports - Get reports (GET) and Create report (POST)
 * Cloudflare Pages Function using D1 directly
 */

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

// GET handler - Get all reports
export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Extract user from token
    const authHeader = request.headers.get('Authorization');
    const hasBearer = !!authHeader && authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader!.replace('Bearer ', '') : '';
    const payload = hasBearer ? decodeJwtPayload(token) : null;
    
    let userId: string | null = payload?.id ?? null;
    let userRole: string | null = payload?.role ?? null;
    
    // If no userId from token, try to get from email
    if (!userId && payload?.email) {
      const stmt = env.DB.prepare('SELECT id, role FROM users WHERE email = ? LIMIT 1');
      const result = await stmt.bind(payload.email).first();
      if (result) {
        userId = result.id as string;
        userRole = result.role as string;
      }
    }
    
    // Get query parameters
    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type') || 'all';
    const statusFilter = url.searchParams.get('status') || 'all';
    
    // Build SQL query
    let sql = `
      SELECT 
        r.*,
        u.id as submitter_id,
        u.email as submitter_email,
        u.first_name as submitter_first_name,
        u.last_name as submitter_last_name,
        u.role as submitter_role
      FROM reports r
      LEFT JOIN users u ON r.submitted_by = u.id
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Apply role-based filtering
    if (userRole !== 'admin' && userId) {
      conditions.push('r.submitted_by = ?');
      params.push(userId);
    }
    
    // Apply type filter
    if (typeFilter && typeFilter !== 'all') {
      conditions.push('r.report_type = ?');
      params.push(typeFilter);
    }
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      conditions.push('r.status = ?');
      params.push(statusFilter);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY r.created_at DESC';
    
    // Execute query
    const stmt = env.DB.prepare(sql);
    const results = await stmt.bind(...params).all();
    
    // Transform results to match expected format
    const reports = results.results.map((row: any) => {
      // Parse extraData if it's a JSON string
      let extraData = null;
      if (row.extra_data) {
        try {
          extraData = typeof row.extra_data === 'string' ? JSON.parse(row.extra_data) : row.extra_data;
        } catch {
          extraData = row.extra_data;
        }
      }
      
      return {
        id: row.id,
        reportType: row.report_type,
        status: row.status,
        submittedBy: row.submitted_by,
        isAnonymous: row.is_anonymous === 1,
        description: row.description || '',
        flightNumber: row.flight_number,
        aircraftType: row.aircraft_type,
        route: row.route,
        eventDateTime: row.event_date_time,
        contributingFactors: row.contributing_factors,
        correctiveActions: row.corrective_actions,
        planImage: row.plan_image,
        elevImage: row.elev_image,
        planUnits: row.plan_units,
        planGridX: row.plan_grid_x,
        planGridY: row.plan_grid_y,
        planDistanceX: row.plan_distance_x,
        planDistanceY: row.plan_distance_y,
        elevGridCol: row.elev_grid_col,
        elevGridRow: row.elev_grid_row,
        elevDistanceHorizM: row.elev_distance_horiz_m,
        elevDistanceVertFt: row.elev_distance_vert_ft,
        location: row.location,
        phaseOfFlight: row.phase_of_flight,
        riskLevel: row.risk_level,
        followUpActions: row.follow_up_actions,
        groundCrewNames: row.ground_crew_names,
        vehicleInvolved: row.vehicle_involved,
        damageType: row.damage_type,
        correctiveSteps: row.corrective_steps,
        department: row.department,
        nonconformityType: row.nonconformity_type,
        rootCause: row.root_cause,
        responsiblePerson: row.responsible_person,
        preventiveActions: row.preventive_actions,
        discretionReason: row.discretion_reason,
        timeExtension: row.time_extension,
        crewFatigueDetails: row.crew_fatigue_details,
        finalDecision: row.final_decision,
        potentialImpact: row.potential_impact,
        preventionSuggestions: row.prevention_suggestions,
        extraData,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        submitter: row.submitter_id ? {
          id: row.submitter_id,
          email: row.submitter_email,
          firstName: row.submitter_first_name,
          lastName: row.submitter_last_name,
          role: row.submitter_role,
        } : null,
      };
    });
    
    return new Response(JSON.stringify(reports), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('GET /api/reports error:', error);
    return new Response(JSON.stringify({ 
      message: 'Failed to fetch reports', 
      error: error?.message || String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Parse request body
    const body = await request.json();
    
    // Extract user from token if available
    const authHeader = request.headers.get('Authorization');
    const hasBearer = !!authHeader && authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader!.replace('Bearer ', '') : '';
    const payload = hasBearer ? decodeJwtPayload(token) : null;
    
    let userId: string | null = payload?.id ?? null;
    
    // If no userId from token, try to get from email
    if (!userId && payload?.email) {
      const stmt = env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
      const result = await stmt.bind(payload.email).first();
      if (result) userId = result.id as string;
    }
    
    // If still no userId, use admin/demo fallback
    if (!userId) {
      const candidates = ['admin@airline.com', 'demo@airline.com'];
      for (const email of candidates) {
        const stmt = env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        const result = await stmt.bind(email).first();
        if (result) {
          userId = result.id as string;
          break;
        }
      }
    }
    
    // If no user found, create admin user
    if (!userId) {
      userId = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO users (id, email, first_name, last_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(userId, 'admin@airline.com', 'Admin', 'User', 'admin', now, now).run();
    }
    
    // Prepare report data
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const reportType = body?.reportType ?? 'asr';
    const status = body?.status ?? 'submitted';
    const isAnonymous = body?.isAnonymous ? 1 : 0;
    const description = body?.description ?? '';
    const extraData = typeof body?.extraData === 'string' ? body.extraData : JSON.stringify(body?.extraData ?? {});
    
    // Insert report using raw SQL
    await env.DB.prepare(`
      INSERT INTO reports (
        id, report_type, status, submitted_by, is_anonymous, description,
        flight_number, aircraft_type, route, event_date_time,
        contributing_factors, corrective_actions,
        plan_image, elev_image, plan_units,
        plan_grid_x, plan_grid_y, plan_distance_x, plan_distance_y,
        elev_grid_col, elev_grid_row, elev_distance_horiz_m, elev_distance_vert_ft,
        location, phase_of_flight, risk_level, follow_up_actions,
        ground_crew_names, vehicle_involved, damage_type, corrective_steps,
        department, nonconformity_type, root_cause, responsible_person, preventive_actions,
        discretion_reason, time_extension, crew_fatigue_details, final_decision,
        potential_impact, prevention_suggestions, extra_data,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      id, reportType, status, userId, isAnonymous, description,
      body?.flightNumber ?? null, body?.aircraftType ?? null, body?.route ?? null, body?.eventDateTime ?? null,
      body?.contributingFactors ?? null, body?.correctiveActions ?? null,
      body?.planImage ?? null, body?.elevImage ?? null, body?.planUnits ?? null,
      body?.planGridX ?? null, body?.planGridY ?? null, body?.planDistanceX ?? null, body?.planDistanceY ?? null,
      body?.elevGridCol ?? null, body?.elevGridRow ?? null, body?.elevDistanceHorizM ?? null, body?.elevDistanceVertFt ?? null,
      body?.location ?? null, body?.phaseOfFlight ?? null, body?.riskLevel ?? null, body?.followUpActions ?? null,
      body?.groundCrewNames ?? null, body?.vehicleInvolved ?? null, body?.damageType ?? null, body?.correctiveSteps ?? null,
      body?.department ?? null, body?.nonconformityType ?? null, body?.rootCause ?? null, body?.responsiblePerson ?? null, body?.preventiveActions ?? null,
      body?.discretionReason ?? null, body?.timeExtension ?? null, body?.crewFatigueDetails ?? null, body?.finalDecision ?? null,
      body?.potentialImpact ?? null, body?.preventionSuggestions ?? null, extraData,
      now, now
    ).run();
    
    return new Response(JSON.stringify({ 
      id, 
      reportType,
      status,
      message: 'Report created successfully' 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('POST /api/reports error:', error);
    return new Response(JSON.stringify({ 
      message: 'Failed to create report', 
      error: error?.message || String(error),
      stack: error?.stack || ''
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
