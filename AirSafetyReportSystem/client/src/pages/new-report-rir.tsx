import { useMemo, useState, Fragment } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { TimeInput24 } from "@/components/ui/time-input-24";
import { DateInputDDMMYYYY } from "@/components/ui/date-input-ddmmyyyy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
 

const personSchema = z.object({
  name: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  staffNr: z.string().optional(),
  license: z.string().optional(),
});

const schema = z.object({
  incidentTitle: z.string().optional(),
  damageIn: z.string().optional(),

  damageByAircraft: z.boolean().optional(),
  damageByRampEq: z.boolean().optional(),
  damageByVehicle: z.boolean().optional(),
  damageByForeignObj: z.boolean().optional(),
  damageByJetBlast: z.boolean().optional(),
  damageByUnknown: z.boolean().optional(),
  damageByOther: z.string().optional(),

  date: z.string().optional(),
  timeOfOccurrence: z.string().optional(),
  phaseOfOperation: z.string().optional(),
  areaStand: z.string().optional(),
  aircraftRegistration: z.string().optional(),
  aircraftType: z.string().optional(),
  flightNo: z.string().optional(),
  scheduledGroundTime: z.string().optional(),
  flightDelayHrs: z.string().optional(),
  flightDelayMin: z.string().optional(),
  flightCancelled: z.enum(["yes","no"]).optional(),

  typeOfOccurrence: z.string().optional(),

  casualtiesEmployeesFatal: z.string().optional(),
  casualtiesEmployeesNonFatal: z.string().optional(),
  casualtiesPassengersFatal: z.string().optional(),
  casualtiesPassengersNonFatal: z.string().optional(),
  casualtiesOthersFatal: z.string().optional(),
  casualtiesOthersNonFatal: z.string().optional(),

  // Vehicle/Ramp Eq condition (Serviceable/Faulty)
  tiresSvc: z.boolean().optional(),
  tiresFault: z.boolean().optional(),
  brakesSvc: z.boolean().optional(),
  brakesFault: z.boolean().optional(),
  steeringSvc: z.boolean().optional(),
  steeringFault: z.boolean().optional(),
  lightsSvc: z.boolean().optional(),
  lightsFault: z.boolean().optional(),
  wipersSvc: z.boolean().optional(),
  wipersFault: z.boolean().optional(),
  protectionSvc: z.boolean().optional(),
  protectionFault: z.boolean().optional(),
  warningSvc: z.boolean().optional(),
  warningFault: z.boolean().optional(),
  stabilizersSvc: z.boolean().optional(),
  stabilizersFault: z.boolean().optional(),
  towHitchSvc: z.boolean().optional(),
  towHitchFault: z.boolean().optional(),
  fieldVisionSvc: z.boolean().optional(),
  fieldVisionFault: z.boolean().optional(),

  serialFleetNr: z.string().optional(),
  vehicleType: z.string().optional(),
  owner: z.string().optional(),
  areaVehicle: z.string().optional(),
  vehicleAge: z.string().optional(),
  lastOverhaul: z.string().optional(),
  remarks: z.string().optional(),

  personnel: z.array(personSchema).optional(),

  // Weather/Surface/Lighting
  wRain: z.boolean().optional(),
  wSnow: z.boolean().optional(),
  wSleet: z.boolean().optional(),
  wHail: z.boolean().optional(),
  wFog: z.boolean().optional(),
  visibilityKm: z.string().optional(),
  windGustKts: z.string().optional(),
  temperatureC: z.string().optional(),

  sDry: z.boolean().optional(),
  sWet: z.boolean().optional(),
  sSnow: z.boolean().optional(),
  sSlush: z.boolean().optional(),
  sIce: z.boolean().optional(),
  sContamination: z.boolean().optional(),

  lGood: z.boolean().optional(),
  lPoor: z.boolean().optional(),
  lDay: z.boolean().optional(),
  lNight: z.boolean().optional(),
  lTwilight: z.boolean().optional(),

  contributoryMajor: z.string().optional(),
  contributoryOther: z.string().optional(),

  reportPreparedBy: z.string().optional(),
  reportPosition: z.string().optional(),
  reportSignature: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewReportRIR() {
  const { user } = useAuth();
  const canCreate = useMemo(() => user?.role === 'captain' || user?.role === 'first_officer', [user?.role]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);

  const { register, control, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { personnel: [{}, {}, {}] },
  });

  useFieldArray({ control, name: 'personnel' });

  const onSubmit = async (data: FormData) => {
    if (!canCreate) {
      toast({ title: 'Not allowed', description: 'Admins cannot create reports', variant: 'destructive' });
      return;
    }

    const summary: string[] = [];
    if (data.incidentTitle) summary.push(`Incident: ${data.incidentTitle}`);
    if (data.typeOfOccurrence) summary.push(`Type: ${data.typeOfOccurrence}`);
    if (data.date || data.timeOfOccurrence) summary.push(`When: ${data.date || ''} ${data.timeOfOccurrence || ''}`.trim());
    if (data.remarks) summary.push(`Remarks: ${data.remarks}`);

    const payload = {
      reportType: 'rir',
      description: summary.join('\n'),
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
      toast({ title: 'Submitted', description: 'Ramp Incident Report created successfully' });
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-6xl mx-auto p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Ramp Incident Report (RIR)</h1>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Incident Title</label>
              <Textarea rows={2} {...register('incidentTitle')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm">Damage in (Aircraft, Equipment, Facilities)</label>
                  <Input {...register('damageIn')} />
                </div>
                <div className="text-sm font-medium">Damage by:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" {...register('damageByAircraft')} /> Aircraft</label>
                  <label className="flex items-center gap-2"><input type="checkbox" {...register('damageByRampEq')} /> Ramp Equipment</label>
                  <label className="flex items-center gap-2"><input type="checkbox" {...register('damageByVehicle')} /> Vehicle</label>
                  <label className="flex items-center gap-2"><input type="checkbox" {...register('damageByForeignObj')} /> Foreign Object</label>
                  <label className="flex items-center gap-2"><input type="checkbox" {...register('damageByJetBlast')} /> Jet Blast</label>
                  <label className="flex items-center gap-2"><input type="checkbox" {...register('damageByUnknown')} /> Unknown</label>
                </div>
                <div>
                  <label className="text-sm">Other (specify)</label>
                  <Input {...register('damageByOther')} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Date</label>
                    <DateInputDDMMYYYY
                      value={watch('date')}
                      onChange={(val) => setValue('date', val)}
                    />
                  </div>
                  <div>
                    <label className="text-sm">Time of occurrence</label>
                    <TimeInput24
                      value={watch('timeOfOccurrence')}
                      onChange={(val) => setValue('timeOfOccurrence', val)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Phase of operation</label>
                    <Input {...register('phaseOfOperation')} />
                  </div>
                  <div>
                    <label className="text-sm">Area (Stand, etc.)</label>
                    <Input {...register('areaStand')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Aircraft Registration</label>
                    <Input {...register('aircraftRegistration')} />
                  </div>
                  <div>
                    <label className="text-sm">Aircraft Type</label>
                    <Input {...register('aircraftType')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Flight No.</label>
                    <Input {...register('flightNo')} />
                  </div>
                  <div>
                    <label className="text-sm">Scheduled Ground Time</label>
                    <Input {...register('scheduledGroundTime')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm">Flight Delay (hrs)</label>
                      <Input {...register('flightDelayHrs')} />
                    </div>
                    <div>
                      <label className="text-sm">(min)</label>
                      <Input {...register('flightDelayMin')} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm">Flight Cancelled (Yes/No)</label>
                    <Controller
                      name="flightCancelled"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select yes/no" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Type of Occurrence</label>
              <Input {...register('typeOfOccurrence')} />
            </div>

            {/* Casualties */}
            <Card className="p-4 space-y-3">
              <div className="font-medium">Number of Casualties</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <div>Employees - Fatalities</div>
                  <Input {...register('casualtiesEmployeesFatal')} />
                </div>
                <div>
                  <div>Employees - Non Fatal</div>
                  <Input {...register('casualtiesEmployeesNonFatal')} />
                </div>
                <div>
                  <div>Passengers - Fatalities</div>
                  <Input {...register('casualtiesPassengersFatal')} />
                </div>
                <div>
                  <div>Passengers - Non Fatal</div>
                  <Input {...register('casualtiesPassengersNonFatal')} />
                </div>
                <div>
                  <div>Others - Fatalities</div>
                  <Input {...register('casualtiesOthersFatal')} />
                </div>
                <div>
                  <div>Others - Non Fatal</div>
                  <Input {...register('casualtiesOthersNonFatal')} />
                </div>
              </div>
            </Card>

            {/* Vehicle/Ramp Eq details */}
            <Card className="p-4 space-y-3">
              <div className="font-medium">Vehicle/Ramp Equipment Details and Condition</div>
              
              {/* Desktop/Tablet View: Table Layout */}
              <div className="hidden sm:block overflow-x-auto">
                <div className="min-w-full grid grid-cols-4 gap-3 text-sm items-center">
                  <div className="col-span-2 font-medium">Equipment Item Name</div>
                  <div className="text-center font-medium">Serviceable</div>
                  <div className="text-center font-medium">Faulty</div>
                  {[
                    ['Tires','tiresSvc','tiresFault'],
                    ['Brakes','brakesSvc','brakesFault'],
                    ['Steering','steeringSvc','steeringFault'],
                    ['Lights','lightsSvc','lightsFault'],
                    ['Wipers','wipersSvc','wipersFault'],
                    ['Protection','protectionSvc','protectionFault'],
                    ['Warning Devices','warningSvc','warningFault'],
                    ['Stabilizers','stabilizersSvc','stabilizersFault'],
                    ['Tow Hitch','towHitchSvc','towHitchFault'],
                    ['Field of Vision from Driving Position','fieldVisionSvc','fieldVisionFault'],
                  ].map(([label, svc, flt], idx) => (
                    <Fragment key={idx}>
                      <div className="col-span-2 text-sm">{label}</div>
                      <div className="flex justify-center">
                        <input 
                          type="checkbox" 
                          {...register(svc as any)} 
                          className="h-4 w-4"
                        />
                      </div>
                      <div className="flex justify-center">
                        <input 
                          type="checkbox" 
                          {...register(flt as any)} 
                          className="h-4 w-4"
                        />
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>

              {/* Mobile View: Card Layout */}
              <div className="sm:hidden space-y-3">
                {[
                  ['Tires','tiresSvc','tiresFault'],
                  ['Brakes','brakesSvc','brakesFault'],
                  ['Steering','steeringSvc','steeringFault'],
                  ['Lights','lightsSvc','lightsFault'],
                  ['Wipers','wipersSvc','wipersFault'],
                  ['Protection','protectionSvc','protectionFault'],
                  ['Warning Devices','warningSvc','warningFault'],
                  ['Stabilizers','stabilizersSvc','stabilizersFault'],
                  ['Tow Hitch','towHitchSvc','towHitchFault'],
                  ['Field of Vision from Driving Position','fieldVisionSvc','fieldVisionFault'],
                ].map(([label, svc, flt], idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border border-border rounded-md">
                    <span className="text-sm font-medium flex-1 pr-2">{label}</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1 text-xs">
                        <input 
                          type="checkbox" 
                          {...register(svc as any)} 
                          className="h-4 w-4"
                        />
                        <span>Serviceable</span>
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input 
                          type="checkbox" 
                          {...register(flt as any)} 
                          className="h-4 w-4"
                        />
                        <span>Faulty</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="text-sm">Serial Fleet Nr.</label>
                  <Input {...register('serialFleetNr')} />
                </div>
                <div>
                  <label className="text-sm">Type</label>
                  <Input {...register('vehicleType')} />
                </div>
                <div>
                  <label className="text-sm">Owner</label>
                  <Input {...register('owner')} />
                </div>
                <div>
                  <label className="text-sm">Area (Stand, etc.)</label>
                  <Input {...register('areaVehicle')} />
                </div>
                <div>
                  <label className="text-sm">Age of Vehicle/Ramp Eq.</label>
                  <Input {...register('vehicleAge')} />
                </div>
                <div>
                  <label className="text-sm">Last Overhaul</label>
                  <Input {...register('lastOverhaul')} />
                </div>
              </div>
              <div>
                <label className="text-sm">Remarks</label>
                <Textarea rows={4} {...register('remarks')} />
              </div>
            </Card>

            {/* Personnel involved */}
            <Card className="p-4 space-y-3">
              <div className="font-medium">Details of Personnel Involved</div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {watch('personnel')?.map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div>
                      <label className="text-sm">Name</label>
                      <Input {...register(`personnel.${i}.name` as const)} />
                    </div>
                    <div>
                      <label className="text-sm">Job Title</label>
                      <Input {...register(`personnel.${i}.jobTitle` as const)} />
                    </div>
                    <div>
                      <label className="text-sm">Company</label>
                      <Input {...register(`personnel.${i}.company` as const)} />
                    </div>
                    <div>
                      <label className="text-sm">Staff Nr. (if known)</label>
                      <Input {...register(`personnel.${i}.staffNr` as const)} />
                    </div>
                    <div>
                      <label className="text-sm">License</label>
                      <Input {...register(`personnel.${i}.license` as const)} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Conditions */}
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium mb-1">Weather Conditions</div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center"><span>Visibility (km)</span><Input className="w-28" {...register('visibilityKm')} /></div>
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center"><span>Wind/gust (kts)</span><Input className="w-28" {...register('windGustKts')} /></div>
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center"><span>Temperature (°C)</span><Input className="w-28" {...register('temperatureC')} /></div>
                    {['Rain','Snow','Sleet','Hail','Fog'].map((k) => (
                      <label key={k} className="flex items-center gap-2"><input type="checkbox" {...register(`w${k}` as any)} /> {k}</label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-1">Surface Conditions</div>
                  <div className="space-y-2">
                    {[
                      ['Dry','sDry'],['Wet','sWet'],['Snow','sSnow'],['Slush','sSlush'],['Ice','sIce'],['Contamination','sContamination']
                    ].map(([label, key]) => (
                      <label key={key} className="flex items-center gap-2"><input type="checkbox" {...register(key as any)} /> {label}</label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-1">Lighting Conditions</div>
                  <div className="space-y-2">
                    {[
                      ['Good','lGood'],['Poor','lPoor'],['Day','lDay'],['Night','lNight'],['Twilight','lTwilight']
                    ].map(([label, key]) => (
                      <label key={key} className="flex items-center gap-2"><input type="checkbox" {...register(key as any)} /> {label}</label>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Contributory factors */}
            <Card className="p-4 space-y-3">
              <div className="font-medium">Contributory Factors (if known to identify)</div>
              <div>
                <label className="text-sm">Major factor (as per GSIM)</label>
                <Textarea rows={3} {...register('contributoryMajor')} />
              </div>
              <div>
                <label className="text-sm">Other factors (specify)</label>
                <Textarea rows={3} {...register('contributoryOther')} />
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm">Report prepared by</label>
                  <Input {...register('reportPreparedBy')} />
                </div>
                <div>
                  <label className="text-sm">Position</label>
                  <Input {...register('reportPosition')} />
                </div>
                
              </div>
            </Card>

          </Card>

          <div className="flex justify-center sm:justify-end">
            <Button 
              type="button" 
              disabled={isSubmitting} 
              className="w-full sm:w-auto px-8"
              onClick={handleSubmit((data) => {
                setPendingSubmit(() => () => onSubmit(data));
                setShowConfirmDialog(true);
              })}
            >
              {isSubmitting ? 'Submitting...' : 'Submit RIR'}
            </Button>
          </div>
        </form>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to submit this Ramp Incident Report (RIR)? The report will be saved and submitted to the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowConfirmDialog(false);
                  if (pendingSubmit) {
                    pendingSubmit();
                    setPendingSubmit(null);
                  }
                }}
              >
                Confirm Submit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}


