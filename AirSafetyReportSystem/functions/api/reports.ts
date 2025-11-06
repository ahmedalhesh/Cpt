/**
 * /api/reports - Get reports (GET) and Create report (POST)
 * Cloudflare Pages Function using D1 directly
 */

import { resolveUserId } from './lib/auth';
import { verifyJWT, decodeJwtPayload } from './lib/jwt';
import { sanitizeObject, commonSchemas } from './lib/validation';

async function decodeJwtPayloadSecure(token: string, secret: string): Promise<any | null> {
  // Try secure verification first
  if (secret && secret.length >= 32) {
    const verified = await verifyJWT(token, secret);
    if (verified) return verified;
  }
  // Fallback to decode for backward compatibility
  return decodeJwtPayload(token);
}

// GET handler - Get all reports from separate tables
export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Extract user from token using secure verification
    const JWT_SECRET = env.JWT_SECRET || 'default-secret-key-change-in-production-minimum-32-chars';
    let userId: string | null = await resolveUserId(request, env);
    
    let userRole: string | null = null;
    
    // If we have userId, resolve role from database
    if (userId) {
      const stmt = env.DB.prepare('SELECT role FROM users WHERE id = ? LIMIT 1');
      const result = await stmt.bind(userId).first();
      if (result) {
        userRole = result.role as string;
      }
    }
    
    // Fallback: try to get from token payload if userId resolution failed
    if (!userId) {
      const authHeader = request.headers.get('Authorization');
      const hasBearer = !!authHeader && authHeader.startsWith('Bearer ');
      const token = hasBearer ? authHeader!.replace('Bearer ', '') : '';
      if (token) {
        const payload = await decodeJwtPayloadSecure(token, JWT_SECRET);
        if (payload?.id) {
          userId = payload.id;
          userRole = payload.role || null;
        } else if (payload?.email) {
          const stmt = env.DB.prepare('SELECT id, role FROM users WHERE email = ? LIMIT 1');
          const result = await stmt.bind(payload.email).first();
          if (result) {
            userId = result.id as string;
            userRole = result.role as string;
          }
        }
      }
    }

    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type') || 'all';
    const statusFilter = url.searchParams.get('status') || 'all';

    const applyStatus = (base: string, alias: string) => statusFilter !== 'all' ? `${base} ${base.includes('WHERE') ? 'AND' : 'WHERE'} ${alias}.status = ?` : base;
    const applyRole = (base: string, alias: string) => (userRole !== 'admin' && userId) ? `${base} ${base.includes('WHERE') ? 'AND' : 'WHERE'} ${alias}.submitted_by = ?` : base;

    const rows: any[] = [];

    // Helper to run and map
    async function fetchASR() {
      const alias = 'r';
      let sql = `SELECT r.*, u.id as submitter_id, u.email as submitter_email, u.first_name as submitter_first_name, u.last_name as submitter_last_name, u.role as submitter_role FROM asr_reports r LEFT JOIN users u ON r.submitted_by = u.id`;
      sql = applyRole(sql, alias);
      sql = applyStatus(sql, alias);
      const params: any[] = [];
      if (userRole !== 'admin' && userId) params.push(userId);
      if (statusFilter !== 'all') params.push(statusFilter);
      const res = await env.DB.prepare(sql).bind(...params).all();
      for (const row of res.results || []) {
        // Try to extract extraData from description
        let extraData = null;
        const desc = row.description || '';
        const extraDataMatch = desc.match(/Extra Data:\s*({[\s\S]*})/);
        if (extraDataMatch) {
          try {
            extraData = JSON.parse(extraDataMatch[1]);
          } catch (e) {
            console.error('Error parsing extraData from description:', e);
            // Fallback to basic fields if parsing fails
            extraData = {};
          }
        }
        
        rows.push({
          id: row.id,
          reportType: 'asr',
          status: row.status,
          submittedBy: row.submitted_by,
          isAnonymous: row.is_anonymous === 1,
          description: desc.replace(/Extra Data:\s*{[\s\S]*}/, '').trim(),
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
          phaseOfFlight: row.phase_of_flight,
          riskLevel: row.risk_level,
          preventionSuggestions: row.prevention_suggestions,
          extraData,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          submitter: row.submitter_id ? { id: row.submitter_id, email: row.submitter_email, firstName: row.submitter_first_name, lastName: row.submitter_last_name, role: row.submitter_role } : null,
        });
      }
    }

    async function fetchNCR() {
      const alias = 'r';
      let sql = `SELECT r.*, u.id as submitter_id, u.email as submitter_email, u.first_name as submitter_first_name, u.last_name as submitter_last_name, u.role as submitter_role FROM ncr_reports r LEFT JOIN users u ON r.submitted_by = u.id`;
      sql = applyRole(sql, alias);
      sql = applyStatus(sql, alias);
      const params: any[] = [];
      if (userRole !== 'admin' && userId) params.push(userId);
      if (statusFilter !== 'all') params.push(statusFilter);
      const res = await env.DB.prepare(sql).bind(...params).all();
      for (const row of res.results || []) {
        rows.push({
          id: row.id,
          reportType: 'ncr',
          status: row.status,
          submittedBy: row.submitted_by,
          isAnonymous: row.is_anonymous === 1,
          description: row.description || '',
          department: row.department,
          nonconformityType: row.nonconformity_type,
          rootCause: row.root_cause,
          responsiblePerson: row.responsible_person,
          preventiveActions: row.preventive_actions,
          extraData: {
            sources: row.sources ? row.sources : null,
            recommendations: row.recommendations ? row.recommendations : null,
            generalInfo: row.general_info ? row.general_info : null,
          },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          submitter: row.submitter_id ? { id: row.submitter_id, email: row.submitter_email, firstName: row.submitter_first_name, lastName: row.submitter_last_name, role: row.submitter_role } : null,
        });
      }
    }

    async function fetchOR() {
      const alias = 'r';
      let sql = `SELECT r.*, u.id as submitter_id, u.email as submitter_email, u.first_name as submitter_first_name, u.last_name as submitter_last_name, u.role as submitter_role FROM or_reports r LEFT JOIN users u ON r.submitted_by = u.id`;
      sql = applyRole(sql, alias);
      sql = applyStatus(sql, alias);
      const params: any[] = [];
      if (userRole !== 'admin' && userId) params.push(userId);
      if (statusFilter !== 'all') params.push(statusFilter);
      const res = await env.DB.prepare(sql).bind(...params).all();
      for (const row of res.results || []) {
        rows.push({
          id: row.id,
          reportType: 'or',
          status: row.status,
          submittedBy: row.submitted_by,
          isAnonymous: row.is_anonymous === 1,
          description: row.description || '',
          discretionReason: row.discretion_reason,
          timeExtension: row.time_extension,
          crewFatigueDetails: row.crew_fatigue_details,
          finalDecision: row.final_decision,
          potentialImpact: row.potential_impact,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          submitter: row.submitter_id ? { id: row.submitter_id, email: row.submitter_email, firstName: row.submitter_first_name, lastName: row.submitter_last_name, role: row.submitter_role } : null,
        });
      }
    }

    async function fetchRIR() {
      const alias = 'r';
      let sql = `SELECT r.*, u.id as submitter_id, u.email as submitter_email, u.first_name as submitter_first_name, u.last_name as submitter_last_name, u.role as submitter_role FROM rir_reports r LEFT JOIN users u ON r.submitted_by = u.id`;
      sql = applyRole(sql, alias);
      sql = applyStatus(sql, alias);
      const params: any[] = [];
      if (userRole !== 'admin' && userId) params.push(userId);
      if (statusFilter !== 'all') params.push(statusFilter);
      const res = await env.DB.prepare(sql).bind(...params).all();
      for (const row of res.results || []) {
        rows.push({
          id: row.id,
          reportType: 'rir',
          status: row.status,
          submittedBy: row.submitted_by,
          isAnonymous: row.is_anonymous === 1,
          description: row.description || '',
          aircraftType: row.aircraft_type,
          flightNumber: row.flight_no,
          location: row.area_stand,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          submitter: row.submitter_id ? { id: row.submitter_id, email: row.submitter_email, firstName: row.submitter_first_name, lastName: row.submitter_last_name, role: row.submitter_role } : null,
        });
      }
    }

    async function fetchCDF() {
      const alias = 'r';
      let sql = `SELECT r.*, u.id as submitter_id, u.email as submitter_email, u.first_name as submitter_first_name, u.last_name as submitter_last_name, u.role as submitter_role FROM cdf_reports r LEFT JOIN users u ON r.submitted_by = u.id`;
      sql = applyRole(sql, alias);
      sql = applyStatus(sql, alias);
      const params: any[] = [];
      if (userRole !== 'admin' && userId) params.push(userId);
      if (statusFilter !== 'all') params.push(statusFilter);
      const res = await env.DB.prepare(sql).bind(...params).all();
      for (const row of res.results || []) {
        rows.push({
          id: row.id,
          reportType: 'cdf',
          status: row.status,
          submittedBy: row.submitted_by,
          isAnonymous: row.is_anonymous === 1,
          description: row.description || '',
          flightNumber: row.flight_number,
          aircraftType: row.aircraft_type,
          eventDateTime: row.date, // original date field
          extraData: { type: row.type, remarksActionTaken: row.remarks_action_taken },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          submitter: row.submitter_id ? { id: row.submitter_id, email: row.submitter_email, firstName: row.submitter_first_name, lastName: row.submitter_last_name, role: row.submitter_role } : null,
        });
      }
    }

    async function fetchCHR() {
      const alias = 'r';
      let sql = `SELECT r.*, u.id as submitter_id, u.email as submitter_email, u.first_name as submitter_first_name, u.last_name as submitter_last_name, u.role as submitter_role FROM chr_reports r LEFT JOIN users u ON r.submitted_by = u.id`;
      sql = applyRole(sql, alias);
      sql = applyStatus(sql, alias);
      const params: any[] = [];
      if (userRole !== 'admin' && userId) params.push(userId);
      if (statusFilter !== 'all') params.push(statusFilter);
      const res = await env.DB.prepare(sql).bind(...params).all();
      for (const row of res.results || []) {
        rows.push({
          id: row.id,
          reportType: 'chr',
          status: row.status,
          submittedBy: row.submitted_by,
          isAnonymous: row.is_anonymous === 1,
          description: row.description || '',
          location: row.location,
          riskLevel: row.risk_level,
          correctiveActions: row.corrective_actions,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          submitter: row.submitter_id ? { id: row.submitter_id, email: row.submitter_email, firstName: row.submitter_first_name, lastName: row.submitter_last_name, role: row.submitter_role } : null,
        });
      }
    }

    async function fetchCaptain() {
      const alias = 'r';
      let sql = `SELECT r.*, u.id as submitter_id, u.email as submitter_email, u.first_name as submitter_first_name, u.last_name as submitter_last_name, u.role as submitter_role FROM captain_reports r LEFT JOIN users u ON r.submitted_by = u.id`;
      sql = applyRole(sql, alias);
      sql = applyStatus(sql, alias);
      const params: any[] = [];
      if (userRole !== 'admin' && userId) params.push(userId);
      if (statusFilter !== 'all') params.push(statusFilter);
      const res = await env.DB.prepare(sql).bind(...params).all();
      for (const row of res.results || []) {
        // Try to extract extraData from description
        let extraData = null;
        const desc = row.description || '';
        const extraDataMatch = desc.match(/Extra Data:\s*({[\s\S]*})/);
        if (extraDataMatch) {
          try {
            extraData = JSON.parse(extraDataMatch[1]);
          } catch (e) {
            console.error('Error parsing extraData from description:', e);
            // Fallback to basic fields if parsing fails
            extraData = {
              aircraftReg: row.aircraft_reg || null,
              captainEmail: row.captain_email || null,
              captainComments: row.captain_comments || null,
            };
          }
        } else {
          // Fallback to basic fields if no extraData found in description
          extraData = {
            aircraftReg: row.aircraft_reg || null,
            captainEmail: row.captain_email || null,
            captainComments: row.captain_comments || null,
          };
        }
        
        rows.push({
          id: row.id,
          reportType: 'captain',
          status: row.status,
          submittedBy: row.submitted_by,
          isAnonymous: row.is_anonymous === 1,
          description: desc.replace(/Extra Data:\s*{[\s\S]*}/, '').trim(),
          flightNumber: row.flight_number,
          eventDateTime: row.event_date_time,
          extraData,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          submitter: row.submitter_id ? { id: row.submitter_id, email: row.submitter_email, firstName: row.submitter_first_name, lastName: row.submitter_last_name, role: row.submitter_role } : null,
        });
      }
    }

    // Fetch based on type filter
    if (typeFilter === 'all') {
      await fetchASR();
      await fetchNCR();
      await fetchOR();
      await fetchRIR();
      await fetchCDF();
      await fetchCHR();
      await fetchCaptain();
    } else {
      const map: Record<string, () => Promise<void>> = {
        asr: fetchASR,
        ncr: fetchNCR,
        or: fetchOR,
        rir: fetchRIR,
        cdf: fetchCDF,
        chr: fetchCHR,
        captain: fetchCaptain,
      };
      const fn = map[typeFilter];
      if (fn) await fn();
    }

    // Sort newest first
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('GET /api/reports error:', error);
    return new Response(
      JSON.stringify({ message: 'Failed to fetch reports. Please try again later.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ message: 'Invalid request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Basic validation
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ message: 'Invalid request data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize body
    body = sanitizeObject(body);

    // Extract user from token using secure verification
    const JWT_SECRET = env.JWT_SECRET || 'default-secret-key-change-in-production-minimum-32-chars';
    let userId: string | null = await resolveUserId(request, env);
    
    // Fallback if resolveUserId failed
    if (!userId) {
      const authHeader = request.headers.get('Authorization');
      const hasBearer = !!authHeader && authHeader.startsWith('Bearer ');
      const token = hasBearer ? authHeader!.replace('Bearer ', '') : '';
      if (token) {
        const payload = await decodeJwtPayloadSecure(token, JWT_SECRET);
        if (payload?.id) {
          userId = payload.id;
        } else if (payload?.email) {
          const stmt = env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
          const result = await stmt.bind(payload.email).first();
          if (result) userId = result.id as string;
        }
      }
    }
    if (!userId) {
      const candidates = ['admin@airline.com', 'demo@airline.com'];
      for (const email of candidates) {
        const stmt = env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        const result = await stmt.bind(email).first();
        if (result) { userId = result.id as string; break; }
      }
    }
    if (!userId) {
      userId = crypto.randomUUID();
      const nowUser = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO users (id, email, first_name, last_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(userId, 'admin@airline.com', 'Admin', 'User', 'admin', nowUser, nowUser).run();
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const reportType = (body?.reportType || 'asr').toLowerCase();
    const status = body?.status ?? 'submitted';
    const isAnonymous = body?.isAnonymous ? 1 : 0;
    const description = body?.description ?? '';

    // Branch per table
    if (reportType === 'captain') {
      // For Captain, extraData contains all form fields, save it in description as JSON string (like ASR, CDF, CHR, OR, RIR)
      const captainExtraData = body?.extraData || {};
      
      // Build description for backward compatibility (simple summary)
      const simpleDescription = description || '';
      
      // Store all extraData in description field with JSON string (for complete data preservation)
      const fullDescription = simpleDescription + (simpleDescription ? '\n\nExtra Data: ' : 'Extra Data: ') + JSON.stringify(captainExtraData);
      
      await env.DB.prepare(`INSERT INTO captain_reports (id, status, submitted_by, is_anonymous, description, flight_number, event_date_time, aircraft_reg, captain_email, captain_comments, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, status, userId, isAnonymous, fullDescription, body?.flightNumber ?? null, body?.eventDateTime ?? null, body?.extraData?.aircraftReg ?? null, body?.extraData?.captainEmail ?? null, body?.extraData?.captainComments ?? null, now, now)
        .run();
    } else if (reportType === 'asr') {
      // For ASR, extraData contains all form fields, save it in description as JSON string (like NCR, CDF, CHR, OR, RIR)
      const asrExtraData = body?.extraData || {};
      
      // Build description for backward compatibility (simple summary)
      const simpleDescription = description || '';
      
      // Store all extraData in description field with JSON string (for complete data preservation)
      const fullDescription = simpleDescription + (simpleDescription ? '\n\nExtra Data: ' : 'Extra Data: ') + JSON.stringify(asrExtraData);
      
      await env.DB.prepare(`INSERT INTO asr_reports (id, status, submitted_by, is_anonymous, description, flight_number, aircraft_type, route, event_date_time, contributing_factors, corrective_actions, phase_of_flight, risk_level, prevention_suggestions, plan_image, elev_image, plan_units, plan_grid_x, plan_grid_y, plan_distance_x, plan_distance_y, elev_grid_col, elev_grid_row, elev_distance_horiz_m, elev_distance_vert_ft, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, status, userId, isAnonymous, fullDescription, body?.flightNumber ?? null, body?.aircraftType ?? null, body?.route ?? null, body?.eventDateTime ?? null, body?.contributingFactors ?? null, body?.correctiveActions ?? null, body?.phaseOfFlight ?? null, body?.riskLevel ?? null, body?.preventionSuggestions ?? null, body?.planImage ?? null, body?.elevImage ?? null, body?.planUnits ?? null, body?.planGridX ?? null, body?.planGridY ?? null, body?.planDistanceX ?? null, body?.planDistanceY ?? null, body?.elevGridCol ?? null, body?.elevGridRow ?? null, body?.elevDistanceHorizM ?? null, body?.elevDistanceVertFt ?? null, now, now)
        .run();
    } else if (reportType === 'ncr') {
      // For NCR, extraData contains all form fields, save it in general_info
      const ncrExtraData = body?.extraData || {};
      const sourcesObj: any = {};
      if (ncrExtraData.srcSurvey) sourcesObj.srcSurvey = true;
      if (ncrExtraData.srcCustomerComplaint) sourcesObj.srcCustomerComplaint = true;
      if (ncrExtraData.srcPilotObservation) sourcesObj.srcPilotObservation = true;
      if (ncrExtraData.srcMaintenanceOfficer) sourcesObj.srcMaintenanceOfficer = true;
      if (ncrExtraData.srcOtherMonitoring) sourcesObj.srcOtherMonitoring = true;
      if (ncrExtraData.srcInternalAudit) sourcesObj.srcInternalAudit = true;
      if (ncrExtraData.srcOpsTax) sourcesObj.srcOpsTax = true;
      if (ncrExtraData.srcOtherText) sourcesObj.srcOtherText = ncrExtraData.srcOtherText;
      
      const recommendationsObj: any = {};
      if (ncrExtraData.recommendationFix) recommendationsObj.recommendationFix = ncrExtraData.recommendationFix;
      if (ncrExtraData.recommendationAction) recommendationsObj.recommendationAction = ncrExtraData.recommendationAction;
      
      // Store all extraData in general_info for complete data preservation
      await env.DB.prepare(`INSERT INTO ncr_reports (id, status, submitted_by, is_anonymous, description, department, nonconformity_type, root_cause, responsible_person, preventive_actions, sources, recommendations, general_info, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id, status, userId, isAnonymous, description, 
          body?.department ?? null, 
          body?.nonconformityType ?? null, 
          body?.rootCause ?? null, 
          body?.responsiblePerson ?? null, 
          body?.preventiveActions ?? null, 
          JSON.stringify(sourcesObj), 
          JSON.stringify(recommendationsObj), 
          JSON.stringify(ncrExtraData), // Store all extraData in general_info
          now, now
        )
        .run();
    } else if (reportType === 'or') {
      // For OR, extraData contains all form fields, save it in description as JSON string (like CDF, CHR)
      const orExtraData = body?.extraData || {};
      
      // Build description for backward compatibility (simple summary)
      const simpleDescription = description || '';
      
      // Store all extraData in description field with JSON string (for complete data preservation)
      const fullDescription = simpleDescription + (simpleDescription ? '\n\nExtra Data: ' : 'Extra Data: ') + JSON.stringify(orExtraData);
      
      // Only use columns that exist in the table
      await env.DB.prepare(`INSERT INTO or_reports (id, status, submitted_by, is_anonymous, description, discretion_reason, time_extension, crew_fatigue_details, final_decision, potential_impact, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id, 
          status, 
          userId, 
          isAnonymous, 
          fullDescription, // Store description with extraData JSON (contains all fields)
          body?.discretionReason ?? null, // Keep for backward compatibility
          body?.timeExtension ?? null, 
          body?.crewFatigueDetails ?? null, 
          body?.finalDecision ?? null, 
          body?.potentialImpact ?? null, 
          now, 
          now
        )
        .run();
    } else if (reportType === 'rir') {
      // For RIR, extraData contains all form fields, save it in description as JSON string (like CDF, CHR, OR)
      const rirExtraData = body?.extraData || {};
      
      // Build description for backward compatibility (simple summary)
      const simpleDescription = description || '';
      
      // Store all extraData in description field with JSON string (for complete data preservation)
      const fullDescription = simpleDescription + (simpleDescription ? '\n\nExtra Data: ' : 'Extra Data: ') + JSON.stringify(rirExtraData);
      
      // Only use columns that exist in the table
      await env.DB.prepare(`INSERT INTO rir_reports (id, status, submitted_by, is_anonymous, description, aircraft_type, flight_no, area_stand, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id, 
          status, 
          userId, 
          isAnonymous, 
          fullDescription, // Store description with extraData JSON (contains all fields)
          body?.aircraftType ?? null, // Keep for backward compatibility
          body?.flightNumber ?? null, // Keep for backward compatibility
          body?.location ?? null, // Keep for backward compatibility
          now, 
          now
        )
        .run();
    } else if (reportType === 'cdf') {
      // For CDF, extraData contains all form fields, save it in description as JSON string (like NCR)
      const cdfExtraData = body?.extraData || {};
      
      // Build description for backward compatibility (simple summary)
      const simpleDescription = description || '';
      
      // Store all extraData in description field with JSON string (for complete data preservation)
      const fullDescription = simpleDescription + (simpleDescription ? '\n\nExtra Data: ' : 'Extra Data: ') + JSON.stringify(cdfExtraData);
      
      await env.DB.prepare(`INSERT INTO cdf_reports (id, status, submitted_by, is_anonymous, description, type, flight_number, aircraft_type, date, remarks_action_taken, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id, 
          status, 
          userId, 
          isAnonymous, 
          fullDescription, // Store description with extraData JSON
          body?.extraData?.type ?? null, 
          body?.flightNumber ?? null, 
          body?.aircraftType ?? null, 
          body?.eventDateTime ? new Date(body.eventDateTime).toISOString().slice(0,10) : null, 
          body?.extraData?.remarksActionTaken ?? null, 
          now, 
          now
        )
        .run();
    } else if (reportType === 'chr') {
      // For CHR, extraData contains all form fields, save it in description as JSON string (like CDF)
      const chrExtraData = body?.extraData || {};
      
      // Build description for backward compatibility (simple summary)
      const simpleDescription = description || '';
      
      // Store all extraData in description field with JSON string (for complete data preservation)
      const fullDescription = simpleDescription + (simpleDescription ? '\n\nExtra Data: ' : 'Extra Data: ') + JSON.stringify(chrExtraData);
      
      // Only use columns that exist in the table: id, status, submitted_by, is_anonymous, description, hazard_description, location, risk_level, corrective_actions
      await env.DB.prepare(`INSERT INTO chr_reports (id, status, submitted_by, is_anonymous, description, hazard_description, location, risk_level, corrective_actions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id, 
          status, 
          userId, 
          body?.isAnonymous ?? 0, // isAnonymous is now directly from payload, not extraData
          fullDescription, // Store description with extraData JSON (contains all fields)
          body?.extraData?.hazardDescription ?? null, // Keep for backward compatibility
          body?.location ?? null, 
          body?.riskLevel ?? null, 
          body?.correctiveActions ?? null, // Keep for backward compatibility
          now, 
          now
        )
        .run();
    } else {
      return new Response(JSON.stringify({ message: `Unsupported report type: ${reportType}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Notify admins about new report
    await notifyAdminsOfNewReport(env, { reportId: id, submittedBy: userId!, reportType });

    return new Response(JSON.stringify({ id, reportType, status, message: 'Report created successfully' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('POST /api/reports error:', error);
    return new Response(
      JSON.stringify({ message: 'Failed to create report. Please try again later.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function notifyAdminsOfNewReport(env: any, data: { reportId: string; submittedBy: string; reportType: string }) {
  try {
    await ensureNotificationsTable(env);
    const admins = await env.DB.prepare('SELECT id, email FROM users WHERE lower(role) = "admin"').all();
    const list = admins.results || [];
    if (!list.length) return;
    const now = new Date().toISOString();
    for (const a of list) {
      if (a.id === data.submittedBy) continue;
      await env.DB.prepare('INSERT INTO notifications (id, user_id, title, message, type, is_read, related_report_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), a.id, 'New Report Submitted', `A new ${data.reportType.toUpperCase()} report requires review.`, 'info', 0, data.reportId, now, now)
        .run();

      // Audit log in D1
      await logNotificationAudit(env, {
        eventType: 'new_report_notify',
        userId: data.submittedBy,
        targetUserId: a.id,
        relatedReportId: data.reportId,
        message: `Notify admin ${a.id} about new ${data.reportType}`,
        meta: { reportType: data.reportType },
      });
    }
  } catch (e) {
    console.log('[notifyAdminsOfNewReport] failed:', e?.message || String(e));
  }
}

async function logNotificationAudit(env: any, payload: { eventType: string; userId?: string; targetUserId?: string; relatedReportId?: string | null; notificationId?: string | null; message?: string; meta?: any }) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS notification_audit (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id TEXT,
      target_user_id TEXT,
      related_report_id TEXT,
      notification_id TEXT,
      message TEXT,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run();

    await env.DB.prepare('INSERT INTO notification_audit (id, event_type, user_id, target_user_id, related_report_id, notification_id, message, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(
        crypto.randomUUID(),
        payload.eventType,
        payload.userId || null,
        payload.targetUserId || null,
        payload.relatedReportId || null,
        payload.notificationId || null,
        payload.message || null,
        payload.meta ? JSON.stringify(payload.meta) : null,
      ).run();
  } catch {}
}

async function ensureNotificationsTable(env: any) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      related_report_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`).run();
    const fk = await env.DB.prepare(`PRAGMA foreign_key_list('notifications')`).all();
    const hasReportsFk = (fk.results || []).some((r: any) => String(r.table || '').toLowerCase() === 'reports');
    if (hasReportsFk) {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS notifications_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        is_read INTEGER NOT NULL DEFAULT 0,
        related_report_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`).run();
      await env.DB.prepare(`INSERT INTO notifications_new (id, user_id, title, message, type, is_read, related_report_id, created_at, updated_at)
        SELECT id, user_id, title, message, COALESCE(type,'info'), COALESCE(is_read,0), related_report_id, created_at, updated_at FROM notifications`).run();
      await env.DB.prepare(`DROP TABLE notifications`).run();
      await env.DB.prepare(`ALTER TABLE notifications_new RENAME TO notifications`).run();
    }
  } catch {}
}
