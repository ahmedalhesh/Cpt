import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const dbFile = process.env.DATABASE_URL || './database.sqlite';
const sqlite = new Database(dbFile);

async function main() {
try {
  console.log('Creating demo reports with full details...\n');

    // Find or create a demo user
    let demoUser = sqlite.prepare('SELECT * FROM users WHERE email = ?').get('demo@airline.com');
  
    if (!demoUser) {
      console.log('Creating demo user...');
    const hashedPassword = await bcrypt.hash('password123', 10);
      const userId = crypto.randomUUID();
    
      sqlite.prepare(`
      INSERT INTO users (id, email, password, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, 'demo@airline.com', hashedPassword, 'Demo', 'User', 'captain');
      
      demoUser = { id: userId };
      console.log('✅ Demo user created\n');
  } else {
      console.log('✅ Using existing demo user\n');
    }

    const userId = demoUser.id;

  // Helper function to insert report
    const insertReport = (reportData) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(`
    INSERT INTO reports (
      id, report_type, status, submitted_by, is_anonymous, description,
          flight_number, aircraft_type, route, event_date_time, contributing_factors,
          corrective_actions, phase_of_flight, risk_level,
          plan_units, plan_grid_x, plan_grid_y, plan_distance_x, plan_distance_y,
          elev_grid_col, elev_grid_row, elev_distance_horiz_m, elev_distance_vert_ft,
          location, extra_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        reportData.reportType || 'asr',
        reportData.status || 'submitted',
        userId,
        reportData.isAnonymous || 0,
        reportData.description || '',
        reportData.flightNumber || null,
        reportData.aircraftType || null,
        reportData.route || null,
        reportData.eventDateTime || null,
        reportData.contributingFactors || null,
        reportData.correctiveActions || null,
        reportData.phaseOfFlight || null,
        reportData.riskLevel || null,
        reportData.planUnits || null,
        reportData.planGridX || null,
        reportData.planGridY || null,
        reportData.planDistanceX || null,
        reportData.planDistanceY || null,
        reportData.elevGridCol || null,
        reportData.elevGridRow || null,
        reportData.elevDistanceHorizM || null,
        reportData.elevDistanceVertFt || null,
        reportData.location || null,
        reportData.extraData ? JSON.stringify(reportData.extraData) : null,
        now,
        now
      );
      return { id };
    };

    // 1. ASR Report (Air Safety Report)
    console.log('Creating ASR Report...');
    const asrReport = insertReport({
      reportType: 'asr',
      status: 'in_review',
      isAnonymous: 0,
      description: `Event Type: Near Miss - Airprox
Date: 15 Jan 2024 | Time: 14:30 UTC | Light: DAY
Callsign: ABC123 | Route: LHR / CDG | Aircraft: A320 | Registration: G-ABCD
Phase of Flight: Approach
Altitude: 3000 ft | Speed: 180 kts | Met: VMC
Light: DAY | Standard: UTC
Config: AP=ON Gear=DOWN Flaps=SET Slat=SET Spoiler=RET

Incident Description:
While on final approach to runway 09L, ATC advised of traffic at 12 o'clock at our altitude. We immediately started scanning and identified another aircraft crossing our flight path at approximately 500m horizontal and 100ft vertical separation. We initiated an evasive action by turning right and climbing 200ft as per ATC instructions.

Contributing Factors:
- Poor visibility due to sun glare
- ATC traffic alert timing
- Similar transponder codes causing confusion

Corrective Actions:
- Reported to ATC supervisor
- Requested follow-up investigation
- Enhanced visual scanning procedures implemented`,
      flightNumber: 'ABC123',
      aircraftType: 'A320',
      route: 'LHR / CDG',
      eventDateTime: new Date('2024-01-15T14:30:00Z').toISOString(),
      contributingFactors: 'Poor visibility due to sun glare\nATC traffic alert timing\nSimilar transponder codes causing confusion',
      correctiveActions: 'Reported to ATC supervisor\nRequested follow-up investigation\nEnhanced visual scanning procedures implemented',
      phaseOfFlight: 'Approach',
      riskLevel: 'high',
      planUnits: 'M',
      planGridX: 5,
      planGridY: -3,
      planDistanceX: 500,
      planDistanceY: -300,
      elevGridCol: 17,
      elevGridRow: 13,
      elevDistanceHorizM: 500,
      elevDistanceVertFt: 100,
    });
    console.log(`✅ ASR Report created: ${asrReport.id}\n`);

    // 2. NCR Report (Non-Conformance Report) - Arabic
    console.log('Creating NCR Report...');
  const ncrExtraData = {
      date: '2024-01-16',
      flightDate: '2024-01-15',
      flightNumber: 'XYZ456',
      aircraftType: 'B737',
      aircraftReg: 'A7-BCD',
      captainName: 'محمد أحمد',
      foName: 'علي حسن',
    srcSurvey: true,
    srcCustomerComplaint: true,
      srcPilotObservation: false,
      srcMaintenanceOfficer: false,
      srcOtherMonitoring: false,
      srcInternalAudit: false,
      srcOpsTax: false,
    nonconform_service: true,
      nonconform_safety: false,
      nonconform_security: false,
      nonconformDetails: 'تلقينا شكوى من عميل حول جودة الخدمة المقدمة خلال الرحلة. العميل أبلغ عن تأخير في تقديم الوجبات بالإضافة إلى مشاكل في نظام الترفيه.',
      recommendationFix: 'تحسين نظام إدارة الوجبات والتأكد من توفر جميع خيارات الطعام قبل الإقلاع',
      recommendationAction: 'تدريب طاقم الكابينة على معالجة شكاوى العملاء بشكل أفضل',
      discovererName: 'سارة محمد',
      discovererTitle: 'ضابط خدمة العملاء',
      discovererDate: '2024-01-16',
      rootCauseAnalysis: 'بعد التحقيق، وجدنا أن المشكلة كانت بسبب تأخير في تحميل الوجبات في المطار بالإضافة إلى قصور في تدريب الطاقم الجديد.',
      analystName: 'أحمد خالد',
      analystTitle: 'مدير الجودة',
      analystDate: '2024-01-18',
      directManagerNotes: 'يتم اتخاذ إجراءات فورية لتحسين الخدمة',
    needsCorrection: 'yes',
      correctionDetails: 'تم تعيين فريق عمل لمراقبة جودة الخدمة',
      correctionDueDate: '2024-02-15',
      personAssignedName: 'فاطمة علي',
      personAssignedTitle: 'مشرفة خدمة العملاء',
    proposalApprove: 'yes',
      proposalNotes: 'تمت الموافقة على الإجراءات التصحيحية',
      proposalSignerName: 'خالد عبدالله',
      proposalSignerTitle: 'مدير العمليات',
      proposalSignerDate: '2024-01-20',
      correctionResultDetails: 'تم تنفيذ التدريب بنجاح وتحسين نظام إدارة الوجبات',
      correctionResponsibleDate: '2024-02-10',
      followupDate: '2024-02-20',
      followupResult: 'تم التحقق من تحسين الخدمة ولم يتم استلام أي شكاوى جديدة',
      reportClosureNotes: 'التقرير مغلق بعد تحقيق النتائج المطلوبة',
      closureDate: '2024-02-25',
    };
    const ncrReport = insertReport({
      reportType: 'ncr',
      status: 'closed',
      description: `تقرير عدم مطابقة (NCR)
رقم الرحلة: XYZ456
تاريخ الرحلة: 2024-01-15
نوع الطائرة: B737
تفاصيل: تلقينا شكوى من عميل حول جودة الخدمة المقدمة خلال الرحلة`,
      flightNumber: 'XYZ456',
      aircraftType: 'B737',
      eventDateTime: new Date('2024-01-15T00:00:00Z').toISOString(),
      extraData: ncrExtraData,
    });
    console.log(`✅ NCR Report created: ${ncrReport.id}\n`);

    // 3. OR Report (Occurrence Report)
    console.log('Creating OR Report...');
  const orExtraData = {
      acReg: 'G-EFGH',
      headerDate: '2024-01-17',
      reportRef: 'OR-2024-001',
      occDate: '2024-01-16',
      occTime: '10:45',
      occLocation: 'Gate A12, Terminal 2',
      typeOfOccurrence: 'Ground Equipment Damage',
      staffInvolved: 'John Smith (Ground Crew Supervisor)\nSarah Johnson (Ground Crew Member)',
      details: 'During aircraft pushback, the tow bar disconnected unexpectedly causing minor damage to the nose landing gear door. The incident occurred at low speed (approximately 2 knots) and no injuries were reported. The tow bar pin was found to be worn and should have been replaced during last inspection.',
      damageExtent: 'Minor scratch and dent on nose landing gear door (approximate repair cost: $2,500). Aircraft remained airworthy.',
      rectification: 'Immediate inspection of all tow bars in fleet. Replaced damaged tow bar with new unit. Implemented mandatory daily visual inspection checklist for all ground equipment.',
      remarks: 'Investigation revealed that the tow bar had exceeded its service life by 50 hours. Preventive maintenance schedule has been updated to include more frequent inspections.',
      qaEngineer: 'Michael Brown',
      qaDate: '2024-01-18',
    };
    const orReport = insertReport({
      reportType: 'or',
      status: 'submitted',
      description: `Occurrence Report to Quality Assurance — Un-Airworthy Condition
Type: Ground Equipment Damage
When: 2024-01-16 10:45
Location: Gate A12, Terminal 2
Details: During aircraft pushback, the tow bar disconnected unexpectedly causing minor damage to the nose landing gear door.`,
      location: 'Gate A12, Terminal 2',
      riskLevel: 'medium',
      eventDateTime: new Date('2024-01-16T10:45:00Z').toISOString(),
      extraData: orExtraData,
    });
    console.log(`✅ OR Report created: ${orReport.id}\n`);

    // 4. CDF Report (Commander's Discretion Form)
    console.log('Creating CDF Report...');
  const cdfExtraData = {
      airline: 'Demo Airlines',
      aircraftType: 'A320',
      flightNumber: 'DEF789',
      commander: 'Captain James Wilson',
      date: '2024-01-18',
    type: 'extension',
    crewAcclimatised: true,
    precedingRestGroup: '18to30',
      fdpFromTable: '11:30',
      splitDutyTimeOff: '14:00',
      splitDutyTimeOn: '18:00',
      splitDutyCredit: '0:45',
      inflightReliefRest: 'N/A',
      inflightReliefSeat: 'N/A',
      inflightReliefCredit: '0:00',
      revisedAllowableFdp: '12:15',
      legs: [
        { place: 'LHR', utcPlanned: '06:00', localPlanned: '06:00', utcActual: '06:05', localActual: '06:05', label: 'Duty to start' },
        { place: 'LHR', utcPlanned: '07:30', localPlanned: '07:30', utcActual: '07:35', localActual: '07:35', label: 'Depart' },
        { place: 'CDG', utcPlanned: '09:45', localPlanned: '10:45', utcActual: '09:50', localActual: '10:50', label: 'Arrive' },
        { place: 'CDG', utcPlanned: '11:00', localPlanned: '12:00', utcActual: '11:10', localActual: '12:10', label: 'Depart' },
        { place: 'LHR', utcPlanned: '11:15', localPlanned: '11:15', utcActual: '11:20', localActual: '11:20', label: 'Arrive' },
        { place: 'LHR', utcPlanned: '12:00', localPlanned: '12:00', utcActual: '12:05', localActual: '12:05', label: 'FDP to end' },
      ],
      amountDiscretionHrs: '0',
      amountDiscretionMins: '45',
      maxFlyingHoursNote: 'Total flight time within limits',
      remarksActionTaken: 'Extension granted due to ATC delays beyond crew control. All safety considerations reviewed and accepted. Crew fully briefed on extended duty period.',
      signed1Date: '2024-01-18',
      signed2Date: '2024-01-18',
    forwardedToCAA: true,
    filed: true,
  };
    const cdfReport = insertReport({
      reportType: 'cdf',
      status: 'closed',
      description: `Commander's Discretion Form - Extension of FDP/FH
Flight: DEF789 | Aircraft: A320
Commander: Captain James Wilson
Extension: 0:45 hours due to ATC delays
Remarks: Extension granted due to ATC delays beyond crew control`,
      flightNumber: 'DEF789',
      aircraftType: 'A320',
      eventDateTime: new Date('2024-01-18T06:00:00Z').toISOString(),
      extraData: cdfExtraData,
    });
    console.log(`✅ CDF Report created: ${cdfReport.id}\n`);

    // 5. CHR Report (Confidential Hazard Report) - Arabic
    console.log('Creating CHR Report...');
  const chrExtraData = {
      reportRef: 'CHR-2024-001',
      isAnonymous: false,
      hazardDescription: 'تم اكتشاف مخاطر محتملة في منطقة صيانة الطائرات. هناك مشاكل في الإضاءة الليلية في المنطقة مما قد يؤدي إلى حوادث أثناء عمليات الصيانة. بالإضافة إلى ذلك، يوجد خلل في نظام الإنذار للمعدات الثقيلة.',
      recommendations: 'يوصى بتحديث نظام الإضاءة في منطقة الصيانة وتحسين نظام الإنذار للمعدات. كما ينصح بإجراء تدريبات دورية للطاقم على إجراءات السلامة.',
      reporterName: 'أحمد محمود',
      reporterPosition: 'مهندس صيانة أول',
      reporterIdNo: 'EMP-12345',
      reporterDate: '2024-01-19',
      validationNotes: 'تم التحقق من التقرير واتخاذ الإجراءات اللازمة',
      safetyOfficerName: 'محمد علي',
      safetyOfficerDate: '2024-01-20',
      correctiveActionNotes: 'تم البدء في تحديث نظام الإضاءة وتركيب نظام إنذار محسّن',
      correctiveName: 'خالد سعيد',
      correctiveDate: '2024-01-22',
      followUpActionTaken: 'تم إجراء فحص شامل للمنطقة والتأكد من تطبيق جميع معايير السلامة',
      followUpDecision: 'SAT',
    };
    const chrReport = insertReport({
      reportType: 'chr',
      status: 'in_review',
      description: `Confidential Hazard / Occurrence Report (CHR)
Report ref: CHR-2024-001
Hazard: تم اكتشاف مخاطر محتملة في منطقة صيانة الطائرات
Recommendations: يوصى بتحديث نظام الإضاءة في منطقة الصيانة`,
      eventDateTime: new Date('2024-01-19T00:00:00Z').toISOString(),
      extraData: chrExtraData,
    });
    console.log(`✅ CHR Report created: ${chrReport.id}\n`);

    // 6. RIR Report (Ramp Incident Report)
    console.log('Creating RIR Report...');
  const rirExtraData = {
      incidentTitle: 'Baggage Cart Collision with Aircraft Wing',
      damageIn: 'Left wingtip',
      damageByVehicle: true,
      date: '2024-01-20',
    timeOfOccurrence: '08:15',
      phaseOfOperation: 'Ground Handling - Baggage Loading',
      areaStand: 'Gate B15',
      aircraftRegistration: 'G-IJKL',
      aircraftType: 'B787',
      flightNo: 'GHI012',
      scheduledGroundTime: '1:30',
      flightDelayHrs: '2',
      flightDelayMin: '30',
      flightCancelled: 'no',
      typeOfOccurrence: 'Ground Vehicle/Aircraft Collision',
      casualtiesEmployeesFatal: '0',
      casualtiesEmployeesNonFatal: '0',
      casualtiesPassengersFatal: '0',
      casualtiesPassengersNonFatal: '0',
      casualtiesOthersFatal: '0',
      casualtiesOthersNonFatal: '0',
      tiresSvc: true,
      brakesSvc: true,
      steeringSvc: true,
      lightsSvc: true,
      serialFleetNr: 'BAG-045',
      vehicleType: 'Baggage Tractor',
      owner: 'Ground Handling Services',
      areaVehicle: 'Ramp B',
      vehicleAge: '5 years',
      lastOverhaul: '2023-06-15',
      remarks: 'During baggage loading operations, the baggage cart driver misjudged the clearance distance and collided with the aircraft left wingtip. The wingtip navigation light was damaged and required replacement. Investigation revealed that the driver was new and had not completed the full training program. Aircraft was taken out of service for 2.5 hours for inspection and repair. All safety procedures were followed and no personnel injuries occurred.',
    personnel: [
        {
          name: 'David Thompson',
          jobTitle: 'Baggage Cart Operator',
          company: 'Ground Handling Services',
          staffNr: 'GHS-7890',
          license: 'Ramp Vehicle Operator - Valid',
        },
        {
          name: 'Emily Davis',
          jobTitle: 'Ramp Supervisor',
          company: 'Ground Handling Services',
          staffNr: 'GHS-6543',
          license: 'Ground Operations Supervisor - Valid',
        },
    ],
    wRain: false,
    wSnow: false,
    visibilityKm: '10',
    sDry: true,
      sWet: false,
    };
    const rirReport = insertReport({
      reportType: 'rir',
      status: 'submitted',
      description: `Ramp Incident Report
Title: Baggage Cart Collision with Aircraft Wing
Date: 2024-01-20 | Time: 08:15
Location: Gate B15 | Aircraft: B787 (G-IJKL)
Type: Ground Vehicle/Aircraft Collision`,
      location: 'Gate B15',
      eventDateTime: new Date('2024-01-20T08:15:00Z').toISOString(),
      extraData: rirExtraData,
    });
    console.log(`✅ RIR Report created: ${rirReport.id}\n`);

    console.log('✅ All demo reports created successfully!');
    console.log('\nSummary:');
    console.log(`- ASR Report: ${asrReport.id}`);
    console.log(`- NCR Report: ${ncrReport.id}`);
    console.log(`- OR Report: ${orReport.id}`);
    console.log(`- CDF Report: ${cdfReport.id}`);
    console.log(`- CHR Report: ${chrReport.id}`);
    console.log(`- RIR Report: ${rirReport.id}`);
} catch (error) {
    console.error('Error creating demo reports:', error);
    process.exitCode = 1;
  } finally {
  sqlite.close();
  }
}

main();
