/**
 * /api/reports - Create report (POST)
 * Using SQLite database from GitHub
 */

import { Database } from 'sql.js';

// Cache the database to avoid re-downloading
let cachedDB: Database | null = null;

async function getSQLiteDB(): Promise<Database> {
  if (cachedDB) return cachedDB;
  
  try {
    // Download database from GitHub
    const dbUrl = 'https://raw.githubusercontent.com/ahmedalhesh/Cpt/main/AirSafetyReportSystem/database.sqlite';
    console.log('Downloading database from:', dbUrl);
    
    const response = await fetch(dbUrl);
    if (!response.ok) {
      throw new Error(`Failed to download database: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    console.log('Database downloaded, size:', buffer.byteLength, 'bytes');
    
    // Initialize SQLite database
    cachedDB = new Database(new Uint8Array(buffer));
    console.log('SQLite database initialized');
    
    return cachedDB;
  } catch (error) {
    console.error('Error loading SQLite database:', error);
    throw error;
  }
}

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
    console.log('Creating report:', body.reportType);
    
    // Get SQLite database
    const db = await getSQLiteDB();
    
    // Extract user from token if available
    const authHeader = request.headers.get('Authorization');
    const hasBearer = !!authHeader && authHeader.startsWith('Bearer ');
    const token = hasBearer ? authHeader!.replace('Bearer ', '') : '';
    const payload = hasBearer ? decodeJwtPayload(token) : null;
    
    let userId: string | null = payload?.id ?? null;
    
    // If no userId from token, try to get from email
    if (!userId && payload?.email) {
      const userStmt = db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
      const userResult = userStmt.get(payload.email);
      if (userResult) userId = userResult.id as string;
    }
    
    // If still no userId, use demo user
    if (!userId) {
      const demoStmt = db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
      const demoResult = demoStmt.get('demo@airline.com');
      userId = demoResult ? demoResult.id as string : 'demo-user-id';
    }

    // Generate report ID
    const reportId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Prepare report data with all fields
    const reportData = {
      id: reportId,
      report_type: body?.reportType ?? 'asr',
      status: body?.status ?? 'submitted',
      submitted_by: userId,
      is_anonymous: body?.isAnonymous ? 1 : 0,
      description: body?.description ?? '',
      flight_number: body?.flightNumber ?? null,
      aircraft_type: body?.aircraftType ?? null,
      route: body?.route ?? null,
      event_date_time: body?.eventDateTime ?? null,
      contributing_factors: body?.contributingFactors ?? null,
      corrective_actions: body?.correctiveActions ?? null,
      plan_image: body?.planImage ?? null,
      elev_image: body?.elevImage ?? null,
      plan_units: body?.planUnits ?? null,
      plan_grid_x: body?.planGridX ?? null,
      plan_grid_y: body?.planGridY ?? null,
      plan_distance_x: body?.planDistanceX ?? null,
      plan_distance_y: body?.planDistanceY ?? null,
      elev_grid_col: body?.elevGridCol ?? null,
      elev_grid_row: body?.elevGridRow ?? null,
      elev_distance_horiz_m: body?.elevDistanceHorizM ?? null,
      elev_distance_vert_ft: body?.elevDistanceVertFt ?? null,
      location: body?.location ?? null,
      phase_of_flight: body?.phaseOfFlight ?? null,
      risk_level: body?.riskLevel ?? null,
      follow_up_actions: body?.followUpActions ?? null,
      ground_crew_names: body?.groundCrewNames ?? null,
      vehicle_involved: body?.vehicleInvolved ?? null,
      damage_type: body?.damageType ?? null,
      corrective_steps: body?.correctiveSteps ?? null,
      department: body?.department ?? null,
      nonconformity_type: body?.nonconformityType ?? null,
      root_cause: body?.rootCause ?? null,
      responsible_person: body?.responsiblePerson ?? null,
      preventive_actions: body?.preventiveActions ?? null,
      extra_data: typeof body?.extraData === 'string' ? body.extraData : JSON.stringify(body?.extraData ?? {}),
      discretion_reason: body?.discretionReason ?? null,
      time_extension: body?.timeExtension ?? null,
      crew_fatigue_details: body?.crewFatigueDetails ?? null,
      final_decision: body?.finalDecision ?? null,
      potential_impact: body?.potentialImpact ?? null,
      prevention_suggestions: body?.preventionSuggestions ?? null,
      created_at: now,
      updated_at: now
    };

    // Insert report into SQLite database
    const insertStmt = db.prepare(`
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
        extra_data, discretion_reason, time_extension, crew_fatigue_details, final_decision,
        potential_impact, prevention_suggestions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      reportData.id, reportData.report_type, reportData.status, reportData.submitted_by, reportData.is_anonymous, reportData.description,
      reportData.flight_number, reportData.aircraft_type, reportData.route, reportData.event_date_time,
      reportData.contributing_factors, reportData.corrective_actions,
      reportData.plan_image, reportData.elev_image, reportData.plan_units,
      reportData.plan_grid_x, reportData.plan_grid_y, reportData.plan_distance_x, reportData.plan_distance_y,
      reportData.elev_grid_col, reportData.elev_grid_row, reportData.elev_distance_horiz_m, reportData.elev_distance_vert_ft,
      reportData.location, reportData.phase_of_flight, reportData.risk_level, reportData.follow_up_actions,
      reportData.ground_crew_names, reportData.vehicle_involved, reportData.damage_type, reportData.corrective_steps,
      reportData.department, reportData.nonconformity_type, reportData.root_cause, reportData.responsible_person, reportData.preventive_actions,
      reportData.extra_data, reportData.discretion_reason, reportData.time_extension, reportData.crew_fatigue_details, reportData.final_decision,
      reportData.potential_impact, reportData.prevention_suggestions, reportData.created_at, reportData.updated_at
    );

    console.log('Report created successfully:', reportId);

    return new Response(JSON.stringify({ 
      id: reportId, 
      reportType: reportData.report_type,
      status: reportData.status,
      message: 'Report created successfully (SQLite)',
      data: {
        id: reportId,
        reportType: reportData.report_type,
        status: reportData.status,
        submittedBy: reportData.submitted_by,
        createdAt: reportData.created_at
      }
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