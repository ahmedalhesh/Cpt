import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const schema = z.object({
  // Part A
  airline: z.string().optional(),
  aircraftType: z.string().optional(),
  flightNumber: z.string().optional(),
  commander: z.string().optional(),
  date: z.string().optional(),

  // Discretion type
  type: z.enum(["extension", "reduction"]).default("extension"),

  // Part B - Extension
  crewAcclimatised: z.boolean().optional(),
  precedingRestGroup: z.enum(["18to30", "under18", "over30"]).optional(),
  fdpFromTable: z.string().optional(),
  splitDutyTimeOff: z.string().optional(),
  splitDutyTimeOn: z.string().optional(),
  splitDutyCredit: z.string().optional(),
  inflightReliefRest: z.string().optional(),
  inflightReliefSeat: z.string().optional(),
  inflightReliefCredit: z.string().optional(),
  revisedAllowableFdp: z.string().optional(),

  // Voyage details table (simplified as arrays)
  legs: z.array(
    z.object({
      place: z.string().optional(),
      utcPlanned: z.string().optional(),
      localPlanned: z.string().optional(),
      utcActual: z.string().optional(),
      localActual: z.string().optional(),
      label: z.string().optional(),
    })
  ).optional(),

  amountDiscretionHrs: z.string().optional(),
  amountDiscretionMins: z.string().optional(),
  maxFlyingHoursNote: z.string().optional(),

  // Part C
  remarksActionTaken: z.string().optional(),
  
  signed1Date: z.string().optional(),
  
  signed2Date: z.string().optional(),
  forwardedToCAA: z.boolean().optional(),
  filed: z.boolean().optional(),

  // Reduction of Rest specific
  lastDutyStartedUtc: z.string().optional(),
  lastDutyStartedLocal: z.string().optional(),
  lastDutyEndedUtc: z.string().optional(),
  lastDutyEndedLocal: z.string().optional(),
  restEarnedHours: z.string().optional(),
  calculatedEarliestNextAvailableUtc: z.string().optional(),
  calculatedEarliestNextAvailableLocal: z.string().optional(),
  actualStartNextFdpUtc: z.string().optional(),
  actualStartNextFdpLocal: z.string().optional(),
  restReducedBy: z.string().optional(),
  crewAffected: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewReportCDF() {
  const { user } = useAuth();
  const canCreate = useMemo(() => user?.role === 'captain' || user?.role === 'first_officer', [user?.role]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'extension',
      legs: [
        { label: 'Duty to start' },
        { label: 'Depart' },
        { label: 'Arrive' },
        { label: 'Depart' },
        { label: 'Arrive' },
        { label: 'Depart' },
        { label: 'Arrive' },
        { label: 'Depart' },
        { label: 'Arrive' },
        { label: 'FDP to end' },
        { label: 'Actual FDP' },
      ],
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!canCreate) {
      toast({ title: 'Not allowed', description: 'Admins cannot create reports', variant: 'destructive' });
      return;
    }

    const summary: string[] = [];
    summary.push(`Commander Discretion (${data.type === 'extension' ? 'Extension of FDP/FH' : 'Reduction of Rest'})`);
    if (data.flightNumber) summary.push(`Flight: ${data.flightNumber}`);
    if (data.date) summary.push(`Date: ${data.date}`);
    if (data.aircraftType) summary.push(`AC Type: ${data.aircraftType}`);
    if (data.remarksActionTaken) summary.push(`Remarks: ${data.remarksActionTaken}`);

    const payload = {
      reportType: 'cdf',
      description: summary.join('\n'),
      flightNumber: data.flightNumber,
      aircraftType: data.aircraftType,
      eventDateTime: data.date ? new Date(`${data.date}T00:00:00`).toISOString() : undefined,
      extraData: data,
    } as any;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create report');
      }
      const created = await res.json();
      toast({ title: 'Submitted', description: 'CDF created successfully' });
      setLocation(`/reports/${created.id}`);
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e.message || 'Please try again', variant: 'destructive' });
    }
  };

  if (!canCreate) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="container max-w-5xl mx-auto p-6">
          <Card className="p-6">Admins are not allowed to create reports.</Card>
        </div>
      </div>
    );
  }

  const type = watch('type');

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-6xl mx-auto p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Commander's Discretion Report (CDF)</h1>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {/* Part A */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">Part A</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm">Airline</label>
                <Input {...register('airline')} />
              </div>
              <div>
                <label className="text-sm">Aircraft Type</label>
                <Input {...register('aircraftType')} />
              </div>
              <div>
                <label className="text-sm">Flight Number</label>
                <Input {...register('flightNumber')} />
              </div>
              <div>
                <label className="text-sm">Commander</label>
                <Input {...register('commander')} />
              </div>
              <div>
                <label className="text-sm">Date</label>
                <Input type="date" {...register('date')} />
              </div>
            </div>
          </Card>

          {/* Select CDF Type */}
          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm font-medium">Report Type</label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" value="extension" {...register('type')} defaultChecked /> Extension of FDP/Flying Hours
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" value="reduction" {...register('type')} /> Reduction of Rest
              </label>
            </div>
          </Card>

          {/* Part B - Extension */}
          {type === 'extension' && (
            <Card className="p-4 sm:p-6 space-y-4">
              <h2 className="font-semibold">Part B — Voyage Details (Extension)</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <label className="flex items-center gap-2"><Checkbox checked={!!watch('crewAcclimatised')} onCheckedChange={() => setValue('crewAcclimatised', !watch('crewAcclimatised'))} /> Crew acclimatised</label>
                <div className="flex items-center gap-2">
                  <span>Length of preceding rest:</span>
                  <label className="flex items-center gap-1"><input type="radio" value="18to30" {...register('precedingRestGroup')} />18–30 hrs</label>
                  <label className="flex items-center gap-1"><input type="radio" value="under18" {...register('precedingRestGroup')} />under 18</label>
                  <label className="flex items-center gap-1"><input type="radio" value="over30" {...register('precedingRestGroup')} />over 30</label>
                </div>
                <div>
                  <label className="text-sm">Allowable FDP (Table A/B)</label>
                  <Input {...register('fdpFromTable')} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs">Split duty: time off</label>
                    <Input {...register('splitDutyTimeOff')} />
                  </div>
                  <div>
                    <label className="text-xs">time on</label>
                    <Input {...register('splitDutyTimeOn')} />
                  </div>
                  <div>
                    <label className="text-xs">Credit</label>
                    <Input {...register('splitDutyCredit')} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs">In-flight relief rest taken</label>
                    <Input {...register('inflightReliefRest')} />
                  </div>
                  <div>
                    <label className="text-xs">bunk/seat</label>
                    <Input {...register('inflightReliefSeat')} />
                  </div>
                  <div>
                    <label className="text-xs">Credit</label>
                    <Input {...register('inflightReliefCredit')} />
                  </div>
                </div>
                <div>
                  <label className="text-sm">Revised allowable FDP</label>
                  <Input {...register('revisedAllowableFdp')} />
                </div>
              </div>

              <div className="mt-2">
                <div className="text-sm font-medium mb-2">Voyage Details</div>
                <div className="overflow-auto">
                  <table className="w-full text-xs border">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-2 text-left">Label</th>
                        <th className="p-2 text-left">Place</th>
                        <th className="p-2 text-left">UTC (Planned)</th>
                        <th className="p-2 text-left">Local (Planned)</th>
                        <th className="p-2 text-left">UTC (Actual)</th>
                        <th className="p-2 text-left">Local (Actual)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {watch('legs')?.map((leg, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{leg.label}</td>
                          <td className="p-2"><Input {...register(`legs.${idx}.place` as const)} /></td>
                          <td className="p-2"><Input type="time" {...register(`legs.${idx}.utcPlanned` as const)} /></td>
                          <td className="p-2"><Input type="time" {...register(`legs.${idx}.localPlanned` as const)} /></td>
                          <td className="p-2"><Input type="time" {...register(`legs.${idx}.utcActual` as const)} /></td>
                          <td className="p-2"><Input type="time" {...register(`legs.${idx}.localActual` as const)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm">Amount of Commander's Discretion (Hrs)</label>
                  <Input {...register('amountDiscretionHrs')} />
                </div>
                <div>
                  <label className="text-sm">(Mins)</label>
                  <Input {...register('amountDiscretionMins')} />
                </div>
              </div>
              <div>
                <label className="text-sm">Maximum Flying Hours Permitted note</label>
                <Input placeholder="in 28 days/1 year period. Hours flown ..." {...register('maxFlyingHoursNote')} />
              </div>
            </Card>
          )}

          {/* Part B - Reduction of Rest */}
          {type === 'reduction' && (
            <Card className="p-4 sm:p-6 space-y-4">
              <h2 className="font-semibold">Part B — Reduction of Rest</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Last duty started (UTC)</label>
                  <Input type="datetime-local" {...register('lastDutyStartedUtc')} />
                </div>
                <div>
                  <label className="text-sm">Last duty started (Local)</label>
                  <Input type="datetime-local" {...register('lastDutyStartedLocal')} />
                </div>
                <div>
                  <label className="text-sm">Last duty ended (UTC)</label>
                  <Input type="datetime-local" {...register('lastDutyEndedUtc')} />
                </div>
                <div>
                  <label className="text-sm">Last duty ended (Local)</label>
                  <Input type="datetime-local" {...register('lastDutyEndedLocal')} />
                </div>
                <div>
                  <label className="text-sm">Rest earned (Hours)</label>
                  <Input {...register('restEarnedHours')} />
                </div>
                <div>
                  <label className="text-sm">Calculated earliest next available (UTC)</label>
                  <Input type="datetime-local" {...register('calculatedEarliestNextAvailableUtc')} />
                </div>
                <div>
                  <label className="text-sm">Calculated earliest next available (Local)</label>
                  <Input type="datetime-local" {...register('calculatedEarliestNextAvailableLocal')} />
                </div>
                <div>
                  <label className="text-sm">Actual start of next FDP (UTC)</label>
                  <Input type="datetime-local" {...register('actualStartNextFdpUtc')} />
                </div>
                <div>
                  <label className="text-sm">Actual start of next FDP (Local)</label>
                  <Input type="datetime-local" {...register('actualStartNextFdpLocal')} />
                </div>
                <div>
                  <label className="text-sm">Rest period reduced by</label>
                  <Input {...register('restReducedBy')} />
                </div>
                <div>
                  <label className="text-sm">Crew affected</label>
                  <Input {...register('crewAffected')} />
                </div>
              </div>
            </Card>
          )}

          {/* Part C */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">Part C — Commander's Report</h2>
            <div>
              <label className="text-sm">Remarks / Action Taken</label>
              <Textarea rows={6} {...register('remarksActionTaken')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Date</label>
                <Input type="date" {...register('signed1Date')} />
              </div>
              <div>
                <label className="text-sm">Date</label>
                <Input type="date" {...register('signed2Date')} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={!!watch('forwardedToCAA')} onCheckedChange={(v) => setValue('forwardedToCAA', !!v)} /> Forwarded to CAA</label>
              <label className="flex items-center gap-2"><Checkbox checked={!!watch('filed')} onCheckedChange={(v) => setValue('filed', !!v)} /> Filed</label>
            </div>
          </Card>

          <div className="flex justify-center sm:justify-end">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-8">
              {isSubmitting ? 'Submitting...' : 'Submit CDF'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


