export const onRequestGet = async ({ request, env, params }: { request: Request; env: any; params: any }) => {
  try {
    const id = params?.id || new URL(request.url).pathname.split('/').pop();
    if (!id) {
      return new Response(JSON.stringify({ message: 'Report id is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    async function loadComments(reportId: string) {
      const sql = `SELECT c.*, u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name, u.role as user_role FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.report_id = ? ORDER BY c.created_at ASC`;
      const res = await env.DB.prepare(sql).bind(reportId).all();
      return (res.results || []).map((row: any) => ({ id: row.id, reportId: row.report_id, userId: row.user_id, content: row.content, createdAt: row.created_at, user: { id: row.user_id, email: row.user_email, firstName: row.user_first_name, lastName: row.user_last_name, role: row.user_role } }));
    }

    // Try each table in order
    async function firstRow(sql: string) { return await env.DB.prepare(sql).bind(id).first(); }

    async function loadSubmitter(userId: string | null | undefined) {
      if (!userId) return null;
      const r = await env.DB.prepare('SELECT id, email, first_name, last_name, role FROM users WHERE id = ? LIMIT 1').bind(userId).first();
      return r ? { id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, role: r.role } : null;
    }

    // ASR
    let row = await firstRow(`SELECT r.*, 'asr' as rtype FROM asr_reports r WHERE r.id = ? LIMIT 1`);
    if (row) {
      const comments = await loadComments(row.id);
      const submitter = await loadSubmitter(row.submitted_by);
      
      // Try to extract extraData from description if it contains JSON
      let extraData = null;
      const desc = row.description || '';
      const extraDataMatch = desc.match(/Extra Data:\s*({[\s\S]*})/);
      if (extraDataMatch) {
        try {
          extraData = JSON.parse(extraDataMatch[1]);
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      const report = {
        id: row.id, reportType: 'asr', status: row.status, submittedBy: row.submitted_by, isAnonymous: row.is_anonymous === 1,
        description: desc.replace(/Extra Data:\s*{[\s\S]*}/, '').trim(), flightNumber: row.flight_number, aircraftType: row.aircraft_type, route: row.route, eventDateTime: row.event_date_time,
        contributingFactors: row.contributing_factors, correctiveActions: row.corrective_actions, planImage: row.plan_image, elevImage: row.elev_image,
        planUnits: row.plan_units, planGridX: row.plan_grid_x, planGridY: row.plan_grid_y, planDistanceX: row.plan_distance_x, planDistanceY: row.plan_distance_y,
        elevGridCol: row.elev_grid_col, elevGridRow: row.elev_grid_row, elevDistanceHorizM: row.elev_distance_horiz_m, elevDistanceVertFt: row.elev_distance_vert_ft,
        phaseOfFlight: row.phase_of_flight, riskLevel: row.risk_level, preventionSuggestions: row.prevention_suggestions,
        extraData,
        createdAt: row.created_at, updatedAt: row.updated_at,
        submitter,
        comments,
      };
      return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // NCR
    row = await firstRow(`SELECT r.*, 'ncr' as rtype FROM ncr_reports r WHERE r.id = ? LIMIT 1`);
    if (row) {
      const comments = await loadComments(row.id);
      const submitter = await loadSubmitter(row.submitted_by);
      
      // Try to extract extraData from general_info or description
      let extraData = null;
      
      // First try general_info
      if (row.general_info) {
        try {
          const parsed = JSON.parse(row.general_info);
          extraData = parsed;
        } catch (e) {
          console.error('Error parsing general_info:', e);
        }
      }
      
      // If not found, try to extract from description
      if (!extraData) {
        const desc = row.description || '';
        const extraDataMatch = desc.match(/Extra Data:\s*({[\s\S]*})/);
        if (extraDataMatch) {
          try {
            extraData = JSON.parse(extraDataMatch[1]);
          } catch (e) {
            console.error('Error parsing extraData from description:', e);
          }
        }
      }
      
      // Fallback: if still null, try to parse sources and recommendations separately
      if (!extraData) {
        extraData = {};
        try {
          if (row.sources) {
            const sources = JSON.parse(row.sources);
            if (sources && typeof sources === 'object') {
              Object.assign(extraData, sources);
            }
          }
        } catch (e) {
          // Ignore
        }
        try {
          if (row.recommendations) {
            const recommendations = JSON.parse(row.recommendations);
            if (recommendations && typeof recommendations === 'object') {
              Object.assign(extraData, recommendations);
            }
          }
        } catch (e) {
          // Ignore
        }
      }
      
      const report = {
        id: row.id, reportType: 'ncr', status: row.status, submittedBy: row.submitted_by, isAnonymous: row.is_anonymous === 1,
        description: row.description ? row.description.replace(/Extra Data:\s*{[\s\S]*}/, '').trim() : '',
        department: row.department, nonconformityType: row.nonconformity_type, rootCause: row.root_cause, responsiblePerson: row.responsible_person, preventiveActions: row.preventive_actions,
        extraData,
        createdAt: row.created_at, updatedAt: row.updated_at,
        submitter,
        comments,
      };
      return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // OR
    row = await firstRow(`SELECT r.*, 'or' as rtype FROM or_reports r WHERE r.id = ? LIMIT 1`);
    if (row) {
      const comments = await loadComments(row.id);
      const submitter = await loadSubmitter(row.submitted_by);
      
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
            discretionReason: row.discretion_reason,
            timeExtension: row.time_extension,
            crewFatigueDetails: row.crew_fatigue_details,
            finalDecision: row.final_decision,
            potentialImpact: row.potential_impact,
          };
        }
      } else {
        // Fallback to basic fields if no extraData found in description
        extraData = {
          discretionReason: row.discretion_reason,
          timeExtension: row.time_extension,
          crewFatigueDetails: row.crew_fatigue_details,
          finalDecision: row.final_decision,
          potentialImpact: row.potential_impact,
        };
      }
      
      const report = {
        id: row.id, reportType: 'or', status: row.status, submittedBy: row.submitted_by, isAnonymous: row.is_anonymous === 1,
        description: desc.replace(/Extra Data:\s*{[\s\S]*}/, '').trim(),
        extraData,
        createdAt: row.created_at, updatedAt: row.updated_at,
        submitter,
        comments,
      };
      return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // RIR
    row = await firstRow(`SELECT r.*, 'rir' as rtype FROM rir_reports r WHERE r.id = ? LIMIT 1`);
    if (row) {
      const comments = await loadComments(row.id);
      const submitter = await loadSubmitter(row.submitted_by);
      
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
            aircraftType: row.aircraft_type,
            flightNumber: row.flight_no,
            location: row.area_stand,
          };
        }
      } else {
        // Fallback to basic fields if no extraData found in description
        extraData = {
          aircraftType: row.aircraft_type,
          flightNumber: row.flight_no,
          location: row.area_stand,
        };
      }
      
      const report = {
        id: row.id, reportType: 'rir', status: row.status, submittedBy: row.submitted_by, isAnonymous: row.is_anonymous === 1,
        description: desc.replace(/Extra Data:\s*{[\s\S]*}/, '').trim(),
        extraData,
        createdAt: row.created_at, updatedAt: row.updated_at,
        submitter,
        comments,
      };
      return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // CDF
    row = await firstRow(`SELECT r.*, 'cdf' as rtype FROM cdf_reports r WHERE r.id = ? LIMIT 1`);
    if (row) {
      const comments = await loadComments(row.id);
      const submitter = await loadSubmitter(row.submitted_by);
      
      // Try to extract extraData from description
      let extraData = null;
      const desc = row.description || '';
      const extraDataMatch = desc.match(/Extra Data:\s*({[\s\S]*})/);
      if (extraDataMatch) {
        try {
          extraData = JSON.parse(extraDataMatch[1]);
        } catch (e) {
          console.error('Error parsing extraData from description:', e);
          // Fallback: use basic fields
          extraData = { type: row.type, remarksActionTaken: row.remarks_action_taken };
        }
      } else {
        // Fallback: use basic fields if no extraData found
        extraData = { type: row.type, remarksActionTaken: row.remarks_action_taken };
      }
      
      const report = {
        id: row.id, reportType: 'cdf', status: row.status, submittedBy: row.submitted_by, isAnonymous: row.is_anonymous === 1,
        description: desc.replace(/Extra Data:\s*{[\s\S]*}/, '').trim(), // Remove extraData from description
        flightNumber: row.flight_number, 
        aircraftType: row.aircraft_type, 
        eventDateTime: row.date, 
        extraData,
        createdAt: row.created_at, updatedAt: row.updated_at,
        submitter,
        comments,
      };
      return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // CHR
    row = await firstRow(`SELECT r.*, 'chr' as rtype FROM chr_reports r WHERE r.id = ? LIMIT 1`);
    if (row) {
      const comments = await loadComments(row.id);
      const submitter = await loadSubmitter(row.submitted_by);
      
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
            hazardDescription: row.hazard_description,
          };
        }
      } else {
        // Fallback to basic fields if no extraData found in description
        extraData = {
          hazardDescription: row.hazard_description,
        };
      }
      
      const report = {
        id: row.id, reportType: 'chr', status: row.status, submittedBy: row.submitted_by, isAnonymous: row.is_anonymous === 1,
        description: desc.replace(/Extra Data:\s*{[\s\S]*}/, '').trim(),
        extraData,
        createdAt: row.created_at, updatedAt: row.updated_at,
        submitter,
        comments,
      };
      return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // CAPTAIN
    row = await firstRow(`SELECT r.*, 'captain' as rtype FROM captain_reports r WHERE r.id = ? LIMIT 1`);
    if (row) {
      const comments = await loadComments(row.id);
      const submitter = await loadSubmitter(row.submitted_by);
      
      // Try to extract extraData from description (like ASR, CDF, CHR, OR, RIR)
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
      
      const report = {
        id: row.id, reportType: 'captain', status: row.status, submittedBy: row.submitted_by, isAnonymous: row.is_anonymous === 1,
        description: desc.replace(/Extra Data:\s*{[\s\S]*}/, '').trim(),
        flightNumber: row.flight_number, eventDateTime: row.event_date_time,
        extraData,
        createdAt: row.created_at, updatedAt: row.updated_at,
        submitter,
        comments,
      };
      return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ message: 'Report not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('GET /api/reports/:id error:', error);
    return new Response(JSON.stringify({ message: 'Failed to fetch report', error: error?.message || String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
