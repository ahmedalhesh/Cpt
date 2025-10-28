import { useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const schema = z.object({
  // Office use
  isReportable: z.enum(["yes", "no"]).optional(),

  // 1. Type of event (multi) - all fields optional
  eventTypes: z.array(z.string()).optional(),

  // Crew markers
  cm1: z.string().optional(),
  cm2: z.string().optional(),
  cm3: z.string().optional(),

  // 3-4 Date/Time - all optional
  date: z.string().optional(),
  time: z.string().optional(),
  timeStandard: z.enum(["LOCAL", "UTC"]).default("UTC"),
  light: z.enum(["DAY", "NIGHT"]).optional(),

  // 5-11 Flight basics - all optional
  callsign: z.string().optional(),
  routeFrom: z.string().optional(),
  routeTo: z.string().optional(),
  divertedTo: z.string().optional(),
  aircraftType: z.string().optional(),
  registration: z.string().optional(),
  paxCrew: z.string().optional(),
  techLogPage: z.string().optional(),

  // 12-21 Operation context - all optional
  phaseOfFlight: z.string().optional(),
  altitude: z.string().optional(),
  speedMach: z.string().optional(),
  fuelDumpKg: z.string().optional(),
  metConditions: z.enum(["IMC", "VMC"]).optional(),
  vmcDistanceKm: z.string().optional(),
  wxWind: z.string().optional(),
  wxVisibility: z.string().optional(),
  wxClouds: z.string().optional(),
  wxTemp: z.string().optional(),
  wxQnh: z.string().optional(),
  wxSignificant: z.array(z.string()).optional(),
  runwayDesignator: z.string().optional(),
  runwaySide: z.enum(["L", "C", "R"]).optional(),
  runwayCondition: z.enum(["DRY", "WET", "ICE", "SNOW", "SLUSH", "DEBRIS"]).optional(),
  cfgAutopilot: z.boolean().optional(),
  cfgGear: z.boolean().optional(),
  cfgFlaps: z.boolean().optional(),
  cfgSlat: z.boolean().optional(),
  cfgSpoiler: z.boolean().optional(),

  // 22-24 Narrative - all optional
  eventSummary: z.string().optional(),
  actionTaken: z.string().optional(),
  otherInfo: z.string().optional(),

  // 26 Airprox/ATC/TCAS
  airproxSeverity: z.enum(["low", "medium", "high"]).optional(),
  airproxAvoidingAction: z.enum(["yes", "no"]).optional(),
  airproxReportedToAtc: z.string().optional(),
  airproxAtcInstruction: z.string().optional(),
  airproxFreq: z.string().optional(),
  airproxHeading: z.string().optional(),
  airproxVertSep: z.string().optional(),
  airproxHorizSep: z.string().optional(),
  airproxSquawk: z.string().optional(),
  airproxTcasAlert: z.enum(["RA", "TA", "NONE"]).optional(),
  airproxRaFollowed: z.enum(["yes", "no"]).optional(),
  airproxVertDeviation: z.string().optional(),
  airproxOtherAcType: z.string().optional(),
  airproxOtherAcMarkings: z.string().optional(),
  airproxOtherAcCallsign: z.string().optional(),

  // 26 Graphical selections (Horizontal/Vertical planes)
  airproxPlanX: z.number().optional(),
  airproxPlanY: z.number().optional(),
  airproxPlanUnits: z.enum(["M", "NM"]).optional(),
  // customizable scales
  planMetersPerCell: z.number().optional(), // default 100 m
  planNmPerCell: z.number().optional(), // default 0.1 NM
  airproxElevRow: z.number().optional(),
  airproxElevCol: z.number().optional(),
  airproxElevFeet: z.string().optional(),
  elevMetersPerCell: z.number().optional(), // default 100 m (horizontal)
  elevFeetPerCell: z.number().optional(), // default 100 ft (vertical)

  // 27 Wake turbulence
  wakeHeading: z.string().optional(),
  wakeTurning: z.enum(["LEFT", "RIGHT", "NO"]).optional(),
  wakeGs: z.enum(["HIGH", "LOW", "ON"]).optional(),
  wakeEcl: z.enum(["LEFT", "RIGHT", "ON"]).optional(),
  wakeChangeAtt: z.string().optional(),
  wakeChangeAlt: z.string().optional(),
  wakeBuffet: z.enum(["yes", "no"]).optional(),
  wakeSuspectReason: z.string().optional(),
  wakeVrtAccel: z.string().optional(),
  wakePreceding: z.string().optional(),
  wakeAwareBefore: z.enum(["yes", "no"]).optional(),

  // 28 Bird strike
  birdLocation: z.string().optional(),
  birdType: z.string().optional(),
  // NR SEEN fields (3, 4, 5) with checkboxes
  nrSeen3_1: z.boolean().optional(),
  nrSeen3_2_10: z.boolean().optional(),
  nrSeen3_11_100: z.boolean().optional(),
  nrSeen3_more: z.boolean().optional(),
  nrSeen4_1: z.boolean().optional(),
  nrSeen4_2_10: z.boolean().optional(),
  nrSeen4_11_100: z.boolean().optional(),
  nrSeen4_more: z.boolean().optional(),
  nrSeen5_1: z.boolean().optional(),
  nrSeen5_2_10: z.boolean().optional(),
  nrSeen5_11_100: z.boolean().optional(),
  nrSeen5_more: z.boolean().optional(),

  // Sign-off - all optional
  reporterName: z.string().optional(),
  reporterRank: z.string().optional(),
  reporterDate: z.string().optional(),
  signature: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewReportASR() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      eventTypes: [],
      wxSignificant: [],
      timeStandard: "UTC",
      airproxPlanUnits: 'M',
      planMetersPerCell: 100,
      planNmPerCell: 0.1,
      elevMetersPerCell: 100,
      elevFeetPerCell: 100,
    },
  });

  const canCreate = useMemo(() => user?.role === 'captain' || user?.role === 'first_officer', [user?.role]);
  const planRef = useRef<HTMLDivElement | null>(null);
  const elevRef = useRef<HTMLDivElement | null>(null);

  const onSubmit = async (data: FormData) => {
    if (!canCreate) {
      toast({ title: "Access denied", description: "Admins cannot create reports", variant: "destructive" });
      return;
    }

    const eventDateTimeIso = new Date(`${data.date}T${data.time}:00`).toISOString();

    const headerParts: string[] = [];
    if (data.isReportable) headerParts.push(`Reportable: ${data.isReportable}`);
    if (data.eventTypes?.length) headerParts.push(`Types: ${data.eventTypes.join(', ')}`);
    if (data.cm1 || data.cm2 || data.cm3) headerParts.push(`CM1: ${data.cm1 ?? ''} | CM2: ${data.cm2 ?? ''} | CM3: ${data.cm3 ?? ''}`);
    if (data.light || data.timeStandard) {
      const lightPart = data.light ? `Light: ${data.light}` : '';
      const standardPart = data.timeStandard ? `Standard: ${data.timeStandard}` : '';
      const parts = [lightPart, standardPart].filter(Boolean);
      if (parts.length) headerParts.push(parts.join(' | '));
    }
    if (data.divertedTo) headerParts.push(`DivertedTo: ${data.divertedTo}`);
    if (data.registration || data.paxCrew || data.techLogPage) headerParts.push(`Reg: ${data.registration ?? ''} | Pax/Crew: ${data.paxCrew ?? ''} | TechLog: ${data.techLogPage ?? ''}`);
    const headerLines = headerParts.join('\n');

    const opsParts: string[] = [];
    if (data.altitude || data.speedMach || data.fuelDumpKg) opsParts.push(`Altitude: ${data.altitude ?? ''} | Speed/Mach: ${data.speedMach ?? ''} | FuelDumpKg: ${data.fuelDumpKg ?? ''}`);
    if (data.metConditions) opsParts.push(`MET: ${data.metConditions} ${data.metConditions === 'VMC' ? `(${data.vmcDistanceKm ?? ''} km)` : ''}`);
    if (data.wxWind || data.wxVisibility || data.wxClouds || data.wxTemp || data.wxQnh) opsParts.push(`WX: Wind=${data.wxWind ?? ''} Vis/RVR=${data.wxVisibility ?? ''} Clouds=${data.wxClouds ?? ''} Temp=${data.wxTemp ?? ''}C QNH=${data.wxQnh ?? ''}`);
    if ((data.wxSignificant ?? []).length) opsParts.push(`SignificantWX: ${(data.wxSignificant ?? []).join(', ')}`);
    if (data.runwayDesignator || data.runwaySide || data.runwayCondition) opsParts.push(`Runway: ${data.runwayDesignator ?? ''}${data.runwaySide ? `/${data.runwaySide}` : ''} | Cond: ${data.runwayCondition ?? ''}`);
    // Only add Config line if at least one config field was explicitly set
    if (data.cfgAutopilot !== undefined || data.cfgGear !== undefined || data.cfgFlaps !== undefined || 
        data.cfgSlat !== undefined || data.cfgSpoiler !== undefined) {
      opsParts.push(`Config: AP=${data.cfgAutopilot ? 'ON' : 'OFF'} Gear=${data.cfgGear ? 'DOWN' : 'UP'} Flaps=${data.cfgFlaps ? 'SET' : 'UP'} Slat=${data.cfgSlat ? 'SET' : 'UP'} Spoiler=${data.cfgSpoiler ? 'EXT' : 'RET'}`);
    }
    const opsLines = opsParts.join('\n');

    // airproxPlanX/airproxPlanY represent grid offsets from center
    const planUnits = data.airproxPlanUnits || 'M';
    const planCell = planUnits === 'M' ? 1 : 0.1;
    const planGridX = typeof data.airproxPlanX === 'number' ? data.airproxPlanX : 0;
    const planGridY = typeof data.airproxPlanY === 'number' ? data.airproxPlanY : 0;
    const planDistanceXNum = planGridX * planCell;
    const planDistanceYNum = planGridY * planCell;
    const planXStr = typeof data.airproxPlanX === 'number'
      ? `${(data.airproxPlanX * planCell).toFixed(2)}${planUnits === 'M' ? 'm' : 'NM'}` : '';
    const planYStr = typeof data.airproxPlanY === 'number'
      ? `${(data.airproxPlanY * planCell).toFixed(2)}${planUnits === 'M' ? 'm' : 'NM'}` : '';

    // Elevation distances (relative to grid center)
    const ELEV_CENTER_COL = 14; // 29 columns -> index 14 is center
    const ELEV_CENTER_ROW = 10; // 21 rows -> index 10 is center
    const elevCol = typeof data.airproxElevCol === 'number' ? data.airproxElevCol : ELEV_CENTER_COL;
    const elevRow = typeof data.airproxElevRow === 'number' ? data.airproxElevRow : ELEV_CENTER_ROW;
    const elevMetersPerCell = 100; // Fixed scale
    const elevFeetPerCell = 100; // Fixed scale
    const elevDistanceHorizMNum = (elevCol - ELEV_CENTER_COL) * elevMetersPerCell;
    const elevDistanceVertFtNum = (elevRow - ELEV_CENTER_ROW) * elevFeetPerCell;

    const sec26: string[] = [];
    if (data.airproxSeverity || data.airproxAvoidingAction || data.airproxReportedToAtc) sec26.push(`AIRPROX/ATC/TCAS: Severity=${data.airproxSeverity ?? ''} Avoiding=${data.airproxAvoidingAction ?? ''} ATCUnit=${data.airproxReportedToAtc ?? ''}`);
    if (data.airproxAtcInstruction || data.airproxFreq || data.airproxHeading) sec26.push(`ATCInstr=${data.airproxAtcInstruction ?? ''} Freq=${data.airproxFreq ?? ''} HDG=${data.airproxHeading ?? ''}`);
    if (data.airproxVertSep || data.airproxHorizSep) sec26.push(`Separation: Vert=${data.airproxVertSep ?? ''}ft Horiz=${data.airproxHorizSep ?? ''}`);
    if (data.airproxPlanX !== undefined || data.airproxPlanY !== undefined || data.airproxElevRow !== undefined || data.airproxElevCol !== undefined || data.airproxElevFeet) sec26.push(`Graphical: PLAN x=${planXStr} y=${planYStr} (${planUnits}) | ELEV row=${data.airproxElevRow ?? ''} col=${data.airproxElevCol ?? ''} feet=${data.airproxElevFeet ?? ''}`);
    if (data.airproxSquawk || data.airproxTcasAlert || data.airproxRaFollowed || data.airproxVertDeviation) sec26.push(`Squawk=${data.airproxSquawk ?? ''} TCAS=${data.airproxTcasAlert ?? ''} RA_Followed=${data.airproxRaFollowed ?? ''} Dev=${data.airproxVertDeviation ?? ''}`);
    if (data.airproxOtherAcType || data.airproxOtherAcMarkings || data.airproxOtherAcCallsign) sec26.push(`OtherAC: Type=${data.airproxOtherAcType ?? ''} Markings=${data.airproxOtherAcMarkings ?? ''} Callsign=${data.airproxOtherAcCallsign ?? ''}`);
    const section26 = sec26.join('\n');

    const sec27: string[] = [];
    if (data.wakeHeading || data.wakeTurning || data.wakeGs || data.wakeEcl) sec27.push(`WAKE: HDG=${data.wakeHeading ?? ''} Turning=${data.wakeTurning ?? ''} GS=${data.wakeGs ?? ''} ECL=${data.wakeEcl ?? ''}`);
    if (data.wakeChangeAtt || data.wakeChangeAlt || data.wakeBuffet) sec27.push(`ChangeAtt=${data.wakeChangeAtt ?? ''} ChangeAlt=${data.wakeChangeAlt ?? ''} Buffet=${data.wakeBuffet ?? ''}`);
    if (data.wakeSuspectReason || data.wakeVrtAccel || data.wakePreceding || data.wakeAwareBefore) sec27.push(`Reason=${data.wakeSuspectReason ?? ''} VrtAccel=${data.wakeVrtAccel ?? ''} Preceding=${data.wakePreceding ?? ''} Aware=${data.wakeAwareBefore ?? ''}`);
    const section27 = sec27.join('\n');

    const sec28: string[] = [];
    if (data.birdLocation || data.birdType) sec28.push(`BIRD: Loc=${data.birdLocation ?? ''} Type=${data.birdType ?? ''}`);
    const seen = [
      ['3', data.nrSeen3_1, data.nrSeen3_2_10, data.nrSeen3_11_100, data.nrSeen3_more],
      ['4', data.nrSeen4_1, data.nrSeen4_2_10, data.nrSeen4_11_100, data.nrSeen4_more],
      ['5', data.nrSeen5_1, data.nrSeen5_2_10, data.nrSeen5_11_100, data.nrSeen5_more],
    ];
    seen.forEach(([idx, a, b, c, d]) => {
      if (a || b || c || d) sec28.push(`NR SEEN ${idx}: 1=${a ? 'Y' : 'N'} 2-10=${b ? 'Y' : 'N'} 11-100=${c ? 'Y' : 'N'} MORE=${d ? 'Y' : 'N'}`);
    });
    const section28 = sec28.join('\n');

    const signParts: string[] = [];
    if (data.reporterName || data.reporterRank || data.reporterDate) signParts.push(`Reporter: ${data.reporterName ?? ''} | Rank: ${data.reporterRank ?? ''} | Date: ${data.reporterDate ?? ''}`);
    const signOff = signParts.join('\n');

    const descriptionParts: string[] = [];
    if (headerLines) descriptionParts.push(headerLines);
    if (opsLines) descriptionParts.push(opsLines);
    if (data.eventSummary) descriptionParts.push(`\nEVENT SUMMARY:\n${data.eventSummary}`);
    // Sections 26/27/28 are intentionally omitted from the description per request
    if (signOff) descriptionParts.push(`\nSIGN-OFF:\n${signOff}`);
    const description = descriptionParts.join('\n') || ''; // All fields are optional, but description must be string (not null)

    // Helper function to compress image
    const compressImage = (dataUrl: string, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize if too large
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Use JPEG compression instead of PNG for smaller file size
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
          } else {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    };

    // Capture images for both plots (best-effort; skips if library not available)
    let planImage: string | undefined;
    let elevImage: string | undefined;
    try {
      const mod: any = await import(/* @vite-ignore */ 'html2canvas').catch(() => null);
      if (mod) {
        if (planRef.current) {
          const canvas = await mod.default(planRef.current, { backgroundColor: '#ffffff', scale: 1.5 });
          const originalDataUrl = canvas.toDataURL('image/png');
          planImage = await compressImage(originalDataUrl, 1200, 0.85);
        }
        if (elevRef.current) {
          const canvas = await mod.default(elevRef.current, { backgroundColor: '#ffffff', scale: 1.5 });
          const originalDataUrl = canvas.toDataURL('image/png');
          elevImage = await compressImage(originalDataUrl, 1200, 0.85);
        }
      }
    } catch (_) {
      // ignore capture errors
    }

    // Helper to clean undefined/null values and ensure proper types
    const cleanValue = (value: any, defaultVal?: any): any => {
      if (value === null || value === undefined || value === '') return defaultVal;
      return value;
    };

    const payload: Record<string, any> = {
      reportType: 'asr',
      description: description || '', // All fields are optional, but description must be string (not null)
      flightNumber: cleanValue(data.callsign),
      aircraftType: cleanValue(data.aircraftType),
      route: cleanValue(`${data.routeFrom} / ${data.routeTo}`),
      eventDateTime: cleanValue(eventDateTimeIso),
      phaseOfFlight: cleanValue(data.phaseOfFlight),
      contributingFactors: cleanValue(data.eventTypes?.join(', ')),
      correctiveActions: cleanValue(data.actionTaken, ''),
      preventionSuggestions: cleanValue(data.otherInfo),
      followUpActions: '',
      riskLevel: cleanValue(data.airproxSeverity),

      // Extra explicit coordinates/distances
      planUnits: cleanValue(planUnits),
      planGridX: Number.isInteger(planGridX) ? planGridX : undefined,
      planGridY: Number.isInteger(planGridY) ? planGridY : undefined,
      planDistanceX: Number.isFinite(planDistanceXNum) ? planDistanceXNum : undefined,
      planDistanceY: Number.isFinite(planDistanceYNum) ? planDistanceYNum : undefined,
      elevGridCol: Number.isInteger(elevCol) ? elevCol : undefined,
      elevGridRow: Number.isInteger(elevRow) ? elevRow : undefined,
      elevDistanceHorizM: Number.isFinite(elevDistanceHorizMNum) ? elevDistanceHorizMNum : undefined,
      elevDistanceVertFt: Number.isFinite(elevDistanceVertFtNum) ? elevDistanceVertFtNum : undefined,

      // Images (base64 JPEG or PNG)
      planImage: cleanValue(planImage),
      elevImage: cleanValue(elevImage),
    };

    // Remove undefined values to reduce payload size
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorMessage = err.message || 'Failed to create report';
        const validationErrors = err.errors 
          ? `\nValidation errors: ${JSON.stringify(err.errors, null, 2)}`
          : '';
        throw new Error(errorMessage + validationErrors);
      }

      const created = await res.json();
      toast({ title: 'ASR submitted', description: 'Report created successfully' });
      setLocation(`/reports/${created.id}`);
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e.message || 'Please try again', variant: 'destructive' });
    }
  };

  if (!canCreate) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="container max-w-3xl mx-auto p-6">
          <Card className="p-6">
            Admins are not allowed to create reports.
          </Card>
        </div>
      </div>
    );
  }

  const eventTypeOptions = ["ASR", "AIRPROX/ATC", "TCAS/RA", "WAKE TURBULENCE", "BIRD STRIKE"] as const;
  const wxSigOptions = ["RAIN", "SNOW", "ICING", "FOG", "TURBULENCE", "HAIL", "STANDING WATER", "WINSHEAR"] as const;

  const toggleArrayField = (field: keyof FormData, value: string) => {
    const current = (watch(field) as string[]) || [];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    setValue(field as any, next as any, { shouldValidate: true });
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2 sm:mb-3">
          <h1 className="text-xl sm:text-2xl font-semibold">AIR SAFETY REPORT (ASR)</h1>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <Card className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div>
                <label className="text-sm font-medium">Reportable Occurrence?</label>
                <Select onValueChange={(v) => setValue('isReportable', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">YES</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="text-sm font-medium">CM1</label>
                <Input {...register('cm1')} />
              </div>
              <div>
                <label className="text-sm font-medium">CM2</label>
                <Input {...register('cm2')} />
              </div>
              <div>
                <label className="text-sm font-medium">CM3</label>
                <Input {...register('cm3')} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Type of Event</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 mt-2">
                {eventTypeOptions.map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-xs sm:text-sm">
                    <Checkbox
                      checked={(watch('eventTypes') || []).includes(opt)}
                      onCheckedChange={() => toggleArrayField('eventTypes', opt)}
                    />
                    <span className="break-words">{opt}</span>
                  </label>
                ))}
              </div>
              {errors.eventTypes && <p className="text-xs text-destructive mt-1">{errors.eventTypes.message as string}</p>}
            </div>
          </Card>

          <Card className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" {...register('date')} />
                {errors.date && <p className="text-xs text-destructive mt-1">{errors.date.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Time</label>
                <Input type="time" {...register('time')} />
                {errors.time && <p className="text-xs text-destructive mt-1">{errors.time.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Standard</label>
                <Select defaultValue="UTC" onValueChange={(v) => setValue('timeStandard', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL">LOCAL</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Day/Night</label>
                <Select onValueChange={(v) => setValue('light', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAY">DAY</SelectItem>
                    <SelectItem value="NIGHT">NIGHT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="text-sm font-medium">Callsign</label>
                <Input {...register('callsign')} />
                {errors.callsign && <p className="text-xs text-destructive mt-1">{errors.callsign.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">From</label>
                <Input {...register('routeFrom')} />
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <Input {...register('routeTo')} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Diverted To</label>
                <Input {...register('divertedTo')} />
              </div>
              <div>
                <label className="text-sm font-medium">Aircraft Type</label>
                <Input {...register('aircraftType')} />
              </div>
              <div>
                <label className="text-sm font-medium">Registration</label>
                <Input {...register('registration')} />
              </div>
              <div>
                <label className="text-sm font-medium">Passengers/Crew</label>
                <Input {...register('paxCrew')} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Tech Log Page</label>
                <Input {...register('techLogPage')} />
              </div>
              <div>
                <label className="text-sm font-medium">Phase of Flight</label>
                <Select onValueChange={(v) => setValue('phaseOfFlight', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select phase of flight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOWING">TOWING</SelectItem>
                    <SelectItem value="PARKED">PARKED</SelectItem>
                    <SelectItem value="PUSH BACK">PUSH BACK</SelectItem>
                    <SelectItem value="TAXY OUT">TAXY OUT</SelectItem>
                    <SelectItem value="TAKE-OFF">TAKE-OFF</SelectItem>
                    <SelectItem value="INITIAL CLIMB">INITIAL CLIMB</SelectItem>
                    <SelectItem value="CLIMB">CLIMB</SelectItem>
                    <SelectItem value="CRUISE">CRUISE</SelectItem>
                    <SelectItem value="DESCENT">DESCENT</SelectItem>
                    <SelectItem value="HOLDING">HOLDING</SelectItem>
                    <SelectItem value="APPROACH">APPROACH</SelectItem>
                    <SelectItem value="LANDING">LANDING</SelectItem>
                    <SelectItem value="TAXY IN">TAXY IN</SelectItem>
                  </SelectContent>
                </Select>
                {errors.phaseOfFlight && <p className="text-xs text-destructive mt-1">{errors.phaseOfFlight.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Altitude (ft)</label>
                <Input {...register('altitude')} />
              </div>
              <div>
                <label className="text-sm font-medium">Speed/Mach</label>
                <Input {...register('speedMach')} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Fuel Dump (Kg)</label>
                <Input {...register('fuelDumpKg')} />
              </div>
              <div>
                <label className="text-sm font-medium">MET Conditions</label>
                <Select onValueChange={(v) => setValue('metConditions', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMC">IMC</SelectItem>
                    <SelectItem value="VMC">VMC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">VMC Distance (km)</label>
                <Input {...register('vmcDistanceKm')} />
              </div>
              <div>
                <label className="text-sm font-medium">Runway</label>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="RWY" {...register('runwayDesignator')} />
                  <Select onValueChange={(v) => setValue('runwaySide', v as any)}>
                    <SelectTrigger><SelectValue placeholder="Side" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="R">R</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(v) => setValue('runwayCondition', v as any)}>
                    <SelectTrigger><SelectValue placeholder="Cond" /></SelectTrigger>
                    <SelectContent>
                      {(["DRY","WET","ICE","SNOW","SLUSH","DEBRIS"] as const).map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Wind</label>
                <Input {...register('wxWind')} />
              </div>
              <div>
                <label className="text-sm font-medium">Visibility/RVR</label>
                <Input {...register('wxVisibility')} />
              </div>
              <div>
                <label className="text-sm font-medium">Clouds</label>
                <Input {...register('wxClouds')} />
              </div>
              <div>
                <label className="text-sm font-medium">Temp (°C)</label>
                <Input {...register('wxTemp')} />
              </div>
              <div>
                <label className="text-sm font-medium">QNH (hPa)</label>
                <Input {...register('wxQnh')} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Significant WX</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {wxSigOptions.map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={(watch('wxSignificant') || []).includes(opt)}
                      onCheckedChange={() => toggleArrayField('wxSignificant', opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!watch('cfgAutopilot')} onCheckedChange={(v) => setValue('cfgAutopilot', !!v)} /> Autopilot</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!watch('cfgGear')} onCheckedChange={(v) => setValue('cfgGear', !!v)} /> Gear</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!watch('cfgFlaps')} onCheckedChange={(v) => setValue('cfgFlaps', !!v)} /> Flaps</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!watch('cfgSlat')} onCheckedChange={(v) => setValue('cfgSlat', !!v)} /> Slat</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!watch('cfgSpoiler')} onCheckedChange={(v) => setValue('cfgSpoiler', !!v)} /> Spoiler</label>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Event Summary</label>
              <Textarea rows={5} {...register('eventSummary')} />
              {errors.eventSummary && <p className="text-xs text-destructive mt-1">{errors.eventSummary.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Action Taken / Results / Subsequent Events</label>
              <Textarea rows={4} {...register('actionTaken')} />
            </div>
            <div>
              <label className="text-sm font-medium">Other Information and Suggestions</label>
              <Textarea rows={4} {...register('otherInfo')} />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold mb-2">AIRPROX / ATC INCIDENT / TCAS</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Severity</label>
                <Select onValueChange={(v) => setValue('airproxSeverity', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">LOW</SelectItem>
                    <SelectItem value="medium">MED</SelectItem>
                    <SelectItem value="high">HIGH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Avoiding Action</label>
                <Select onValueChange={(v) => setValue('airproxAvoidingAction', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">YES</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ATC Unit</label>
                <Input {...register('airproxReportedToAtc')} />
              </div>
              <div>
                <label className="text-sm font-medium">ATC Instruction</label>
                <Input {...register('airproxAtcInstruction')} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input placeholder="Frequency" {...register('airproxFreq')} />
              <Input placeholder="Heading (deg)" {...register('airproxHeading')} />
              <Input placeholder="Vertical Sep (ft)" {...register('airproxVertSep')} />
              <Input placeholder="Horizontal Sep (M/NM)" {...register('airproxHorizSep')} />
              <Input placeholder="Squawk" {...register('airproxSquawk')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">TCAS Alert</label>
                <Select onValueChange={(v) => setValue('airproxTcasAlert', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RA">RA</SelectItem>
                    <SelectItem value="TA">TA</SelectItem>
                    <SelectItem value="NONE">NONE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">RA Followed</label>
                <Select onValueChange={(v) => setValue('airproxRaFollowed', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">YES</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Vertical Deviation (ft)" {...register('airproxVertDeviation')} />
              <Input placeholder="Other AC Type" {...register('airproxOtherAcType')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input placeholder="Other AC Markings/Colour" {...register('airproxOtherAcMarkings')} />
              <Input placeholder="Other AC Callsign/Reg" {...register('airproxOtherAcCallsign')} />
            </div>

            {/* Graphical selectors */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mt-4">
              <Card className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                  <h3 className="font-medium text-sm sm:text-base">VIEW FROM ABOVE</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Hundreds of metres</span><span>→</span></div>
                </div>
                {(() => {
                  const COLS = 29; // -14..+14 hundreds
                  const ROWS = 21; // -10..+10 hundreds
                  const centerCol = Math.floor(COLS / 2);
                  const centerRow = Math.floor(ROWS / 2);
                  const planX = watch('airproxPlanX');
                  const planY = watch('airproxPlanY');
                  const unit = watch('airproxPlanUnits') || 'M';
                  const cell = unit === 'M' ? 1 : 0.1; // Fixed scales: 1m/cell or 0.1NM/cell
                  const leftPct = typeof planX === 'number' ? ((planX + centerCol) / (COLS - 1)) * 100 : undefined;
                  const topPct = typeof planY === 'number' ? ((-planY + centerRow) / (ROWS - 1)) * 100 : undefined; // invert Y for screen
                  return (
                    <>
                      <div
                        ref={planRef}
                        className="relative w-full h-64 sm:h-80 lg:h-96 rounded-md cursor-crosshair overflow-visible border mt-4 sm:mt-6 lg:mt-8"
                        style={{
                          // minor grid + major grid (every 5 cells)
                          backgroundImage: `
                            linear-gradient(hsl(var(--muted)) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--muted)) 1px, transparent 1px),
                            linear-gradient(hsl(var(--border)) 2px, transparent 2px),
                            linear-gradient(90deg, hsl(var(--border)) 2px, transparent 2px)
                          `,
                          backgroundSize: `
                            calc(100%/${COLS - 1}) calc(100%/${ROWS - 1}),
                            calc(100%/${COLS - 1}) calc(100%/${ROWS - 1}),
                            calc((100%/${COLS - 1}) * 5) calc((100%/${ROWS - 1}) * 5),
                            calc((100%/${COLS - 1}) * 5) calc((100%/${ROWS - 1}) * 5)
                          `,
                          backgroundColor: 'hsl(var(--background))'
                        }}
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                          const relX = (e.clientX - rect.left) / rect.width; // 0..1
                          const relY = (e.clientY - rect.top) / rect.height; // 0..1
                          const col = Math.round(relX * (COLS - 1));
                          const row = Math.round(relY * (ROWS - 1));
                          setValue('airproxPlanX', col - centerCol);
                          setValue('airproxPlanY', centerRow - row);
                        }}
                      >
                        {/* Center aircraft marker (triangle) */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-primary" />
                        {/* Selected point */}
                        {leftPct !== undefined && topPct !== undefined && (
                          <div
                            className="absolute w-3 h-3 bg-primary rounded-full border border-background"
                            style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: 'translate(-50%, -50%)' }}
                          />
                        )}
                        {/* Top numeric scale fixed (14..0..14) outside */}
                        <div className="absolute top-0 -translate-y-full left-0 right-0 grid grid-cols-[repeat(29,1fr)] text-[10px] text-muted-foreground px-1 py-0 pointer-events-none">
                          {Array.from({ length: COLS }).map((_, i) => {
                            const fromLeft = i; // 0..28
                            const label = fromLeft <= centerCol ? (centerCol - fromLeft) : (fromLeft - centerCol);
                            return <span key={i} className="text-center block">{label}</span>;
                          })}
                        </div>
                        {/* Left numeric scale fixed (10..0..10) outside */}
                        <div className="absolute top-0 bottom-0 left-0 -translate-x-full pr-1 flex flex-col justify-between text-[10px] text-muted-foreground px-1 py-0 whitespace-nowrap pointer-events-none">
                          {Array.from({ length: ROWS }).map((_, i) => {
                            const label = Math.abs(i - centerRow); // 10..0..10
                            return <span key={i}>{label}</span>;
                          })}
                        </div>
                      </div>
                      <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-4 sm:gap-6 text-sm">
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="font-medium text-sm sm:text-base">Distances</div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setValue('airproxPlanX', 0);
                                setValue('airproxPlanY', 0);
                              }}
                              data-testid="btn-reset-plan"
                              className="text-xs sm:text-sm"
                            >
                              Reset
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 items-center">
                            <label className="text-muted-foreground">Distance X ({unit})</label>
                            <Input
                              className="h-9"
                              type="number"
                              step={unit === 'M' ? '1' : '0.01'}
                              value={planX !== undefined ? (planX * cell) : ''}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isNaN(v)) setValue('airproxPlanX', Math.round(v / cell));
                              }}
                            />
                            <label className="text-muted-foreground">Distance Y ({unit})</label>
                            <Input
                              className="h-9"
                              type="number"
                              step={unit === 'M' ? '1' : '0.01'}
                              value={planY !== undefined ? (planY * cell) : ''}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isNaN(v)) setValue('airproxPlanY', Math.round(v / cell));
                              }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Selected grid: x={planX ?? '-'}, y={planY ?? '-'} ({unit}) · Distances: X={planX !== undefined ? ((planX * cell).toFixed(unit === 'M' ? 0 : 2)) : '-'}{unit.toLowerCase()}, Y={planY !== undefined ? ((planY * cell).toFixed(unit === 'M' ? 0 : 2)) : '-'}{unit.toLowerCase()}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                  <h3 className="font-medium text-sm sm:text-base">VIEW FROM ASTERN</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Hundreds of metres</span><span>→</span></div>
                </div>
                {(() => {
                  const COLS = 29; // hundreds of metres horizontally
                  const ROWS = 21; // hundreds of FEET vertically
                  const centerCol = Math.floor(COLS / 2);
                  const centerRow = Math.floor(ROWS / 2);
                  const rSel = watch('airproxElevRow');
                  const cSel = watch('airproxElevCol');
                  const hCellM = 100; // Fixed: 100 meters per cell horizontally
                  const vCellFt = 100; // Fixed: 100 feet per cell vertically
                  const distH = typeof cSel === 'number' ? (cSel - centerCol) * hCellM : '';
                  const distV = typeof rSel === 'number' ? (rSel - centerRow) * vCellFt : '';
                  return (
                    <>
                    <div
                      ref={elevRef}
                      className="relative w-full h-64 sm:h-80 lg:h-96 rounded-md cursor-crosshair overflow-visible border mt-4 sm:mt-6 lg:mt-8"
                      style={{
                        backgroundImage: `
                          linear-gradient(hsl(var(--muted)) 1px, transparent 1px),
                          linear-gradient(90deg, hsl(var(--muted)) 1px, transparent 1px),
                          linear-gradient(hsl(var(--border)) 2px, transparent 2px),
                          linear-gradient(90deg, hsl(var(--border)) 2px, transparent 2px)
                        `,
                        backgroundSize: `
                          calc(100%/${COLS - 1}) calc(100%/${ROWS - 1}),
                          calc(100%/${COLS - 1}) calc(100%/${ROWS - 1}),
                          calc((100%/${COLS - 1}) * 5) calc((100%/${ROWS - 1}) * 5),
                          calc((100%/${COLS - 1}) * 5) calc((100%/${ROWS - 1}) * 5)
                        `,
                        backgroundColor: 'hsl(var(--background))'
                      }}
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const relX = (e.clientX - rect.left) / rect.width;
                        const relY = (e.clientY - rect.top) / rect.height;
                        const col = Math.round(relX * (COLS - 1));
                        const row = Math.round(relY * (ROWS - 1));
                        setValue('airproxElevCol', col);
                        setValue('airproxElevRow', row);
                      }}
                    >
                      {/* Left vertical label */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[120%] pr-2 text-xs text-muted-foreground rotate-[-90deg] origin-right bg-background px-1 whitespace-nowrap">← Hundreds of FEET</div>
                      {/* Right side METRES label centered beside scale (300..0..300) */}
                      <div className="absolute right-0 top-0 bottom-0 translate-x-full pl-2 text-[10px] text-muted-foreground">
                        <div className="relative h-full">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180 text-xs pr-1">METRES</div>
                          <div className="flex flex-col justify-between h-full pr-5">
                            {Array.from({ length: 21 }).map((_, i) => {
                              const label = Math.abs((i - 10) * 30); // 300..0..300
                              return <div key={i}>{label}</div>;
                            })}
                          </div>
                        </div>
                      </div>
                      {/* Selected cell marker */}
                      {typeof rSel === 'number' && typeof cSel === 'number' && (
                        <div
                          className="absolute w-3 h-3 bg-blue-600 rounded-full border border-white"
                          style={{
                            left: `${(cSel / (COLS - 1)) * 100}%`,
                            top: `${(rSel / (ROWS - 1)) * 100}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        />
                      )}
                      {/* Center dot */}
                      <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-[35%] w-2 h-2 bg-primary rounded-full" />
                      {/* Top numeric scale (10..0..10) outside */}
                      <div className="absolute top-0 -translate-y-full left-0 right-0 flex justify-between text-[10px] text-muted-foreground px-1 py-0 pointer-events-none">
                        {Array.from({ length: COLS }).map((_, i) => {
                          const offsetCells = Math.abs(i - centerCol); // 0..14
                          const label = Math.round((offsetCells * 10) / centerCol); // map 0..14 -> 0..10
                          return <span key={i}>{label}</span>;
                        })}
                      </div>
                      {/* Left vertical scale (10..0..10) outside */}
                      <div className="absolute top-0 bottom-0 left-0 -translate-x-full pr-1 flex flex-col justify-between text-[10px] text-muted-foreground p-1 whitespace-nowrap">
                        {Array.from({ length: ROWS }).map((_, i) => {
                          const offsetCells = Math.abs(i - centerRow); // 0..10
                          return <span key={i}>{offsetCells}</span>;
                        })}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-6 text-sm">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Distances</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setValue('airproxElevCol', centerCol);
                              setValue('airproxElevRow', centerRow);
                            }}
                            data-testid="btn-reset-elev"
                          >
                            Reset
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 items-center">
                          <label className="text-muted-foreground">Distance horiz (m)</label>
                          <Input
                            className="h-9"
                            type="number"
                            step="1"
                            value={distH}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isNaN(v)) return;
                              const cells = Math.round(v / 100); // Fixed scale
                              setValue('airproxElevCol', centerCol + cells);
                            }}
                          />
                          <label className="text-muted-foreground">Distance vert (ft)</label>
                          <Input
                            className="h-9"
                            type="number"
                            step="1"
                            value={distV}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isNaN(v)) return;
                              const cells = Math.round(v / 100); // Fixed scale
                              setValue('airproxElevRow', centerRow + cells);
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3 items-center">
                          <label className="text-muted-foreground">VERTICALE PLANE  FEET</label>
                          <Input className="h-9" placeholder="Feet (±ft)" {...register('airproxElevFeet')} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Horizontal metres: {cSel !== undefined ? Math.round((Math.abs(cSel - centerCol)) * 100) : '-'} · Vertical feet: {rSel !== undefined ? Math.round((Math.abs(rSel - centerRow)) * 100) : '-'}
                        </div>
                      </div>
                    </div>
                    </>
                  );
                })()}
                
              </Card>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold mb-2">WAKE TURBULENCE</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input placeholder="Heading (deg)" {...register('wakeHeading')} />
              <Select onValueChange={(v) => setValue('wakeTurning', v as any)}>
                <SelectTrigger><SelectValue placeholder="Turning" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEFT">LEFT</SelectItem>
                  <SelectItem value="RIGHT">RIGHT</SelectItem>
                  <SelectItem value="NO">NO</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => setValue('wakeGs', v as any)}>
                <SelectTrigger><SelectValue placeholder="Glideslope" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">HIGH</SelectItem>
                  <SelectItem value="LOW">LOW</SelectItem>
                  <SelectItem value="ON">ON</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => setValue('wakeEcl', v as any)}>
                <SelectTrigger><SelectValue placeholder="Ext Centerline" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEFT">LEFT</SelectItem>
                  <SelectItem value="RIGHT">RIGHT</SelectItem>
                  <SelectItem value="ON">ON</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Change in Attitude (deg)" {...register('wakeChangeAtt')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input placeholder="Change in Altitude (ft)" {...register('wakeChangeAlt')} />
              <Select onValueChange={(v) => setValue('wakeBuffet', v as any)}>
                <SelectTrigger><SelectValue placeholder="Buffet" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">YES</SelectItem>
                  <SelectItem value="no">NO</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Why suspect wake turbulence?" {...register('wakeSuspectReason')} />
              <Input placeholder="Vertical acceleration" {...register('wakeVrtAccel')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input placeholder="Preceding AC (type/callsign)" {...register('wakePreceding')} />
              <Select onValueChange={(v) => setValue('wakeAwareBefore', v as any)}>
                <SelectTrigger><SelectValue placeholder="Aware before?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">YES</SelectItem>
                  <SelectItem value="no">NO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            <h2 className="font-semibold mb-2 text-sm sm:text-base">28. BIRD STRIKE</h2>
            
            <div className="space-y-3 sm:space-y-4">
              {/* 1. LOCATION */}
              <div>
                <label className="text-sm font-medium">1. LOCATION</label>
                <Input {...register('birdLocation')} />
              </div>

              {/* 2. TYPE OF BIRDS */}
              <div>
                <label className="text-sm font-medium">2. TYPE OF BIRDS:</label>
                <Input {...register('birdType')} />
              </div>

              {/* 3. NR SEEN */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="text-sm font-medium whitespace-nowrap">3. NR SEEN</label>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen3_1')} onCheckedChange={(v) => setValue('nrSeen3_1', !!v)} />
                    1.
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen3_2_10')} onCheckedChange={(v) => setValue('nrSeen3_2_10', !!v)} />
                    2 – 10
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen3_11_100')} onCheckedChange={(v) => setValue('nrSeen3_11_100', !!v)} />
                    11-100
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen3_more')} onCheckedChange={(v) => setValue('nrSeen3_more', !!v)} />
                    MORE
                  </label>
                </div>
              </div>

              {/* 4. NR SEEN */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="text-sm font-medium whitespace-nowrap">4. NR SEEN</label>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen4_1')} onCheckedChange={(v) => setValue('nrSeen4_1', !!v)} />
                    1.
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen4_2_10')} onCheckedChange={(v) => setValue('nrSeen4_2_10', !!v)} />
                    2 – 10
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen4_11_100')} onCheckedChange={(v) => setValue('nrSeen4_11_100', !!v)} />
                    11-100
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen4_more')} onCheckedChange={(v) => setValue('nrSeen4_more', !!v)} />
                    MORE
                  </label>
                </div>
              </div>

              {/* 5. NR SEEN */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="text-sm font-medium whitespace-nowrap">5. NR SEEN</label>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen5_1')} onCheckedChange={(v) => setValue('nrSeen5_1', !!v)} />
                    1.
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen5_2_10')} onCheckedChange={(v) => setValue('nrSeen5_2_10', !!v)} />
                    2 – 10
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen5_11_100')} onCheckedChange={(v) => setValue('nrSeen5_11_100', !!v)} />
                    11-100
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!watch('nrSeen5_more')} onCheckedChange={(v) => setValue('nrSeen5_more', !!v)} />
                    MORE
                  </label>
                </div>
              </div>

              {/* DESCRIBE IMPACT POINT AND DAMAGE OVERLEAF */}
              <div className="mt-3 sm:mt-4">
                <p className="text-xs sm:text-sm font-medium uppercase">DESCRIBE IMPACT POINT AND DAMAGE OVERLEAF</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Reporter Name</label>
                <Input {...register('reporterName')} />
              </div>
              <div>
                <label className="text-sm font-medium">Rank</label>
                <Input {...register('reporterRank')} />
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" {...register('reporterDate')} />
              </div>
              
            </div>
          </Card>

          <div className="flex justify-center sm:justify-end pt-4">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 text-sm sm:text-base"
            >
              {isSubmitting ? 'Submitting...' : 'Submit ASR'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}



