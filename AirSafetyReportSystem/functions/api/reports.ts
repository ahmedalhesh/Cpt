/**
 * /api/reports - Create report (POST)
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
