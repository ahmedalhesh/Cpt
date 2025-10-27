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

const schema = z.object({
  acReg: z.string().optional(),
  headerDate: z.string().optional(),
  reportRef: z.string().optional(),
  occDate: z.string().optional(),
  occTime: z.string().optional(),
  occLocation: z.string().optional(),
  typeOfOccurrence: z.string().optional(),
  staffInvolved: z.string().optional(),
  details: z.string().optional(),
  damageExtent: z.string().optional(),
  rectification: z.string().optional(),
  remarks: z.string().optional(),
  qaEngineer: z.string().optional(),
  qaDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewReportOR() {
  const { user } = useAuth();
  const canCreate = useMemo(() => user?.role === 'captain' || user?.role === 'first_officer', [user?.role]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const onSubmit = async (data: FormData) => {
    if (!canCreate) {
      toast({ title: 'Not allowed', description: 'Admins cannot create reports', variant: 'destructive' });
      return;
    }

    const summary: string[] = [];
    summary.push('Occurrence Report to Quality Assurance — Un-Airworthy Condition');
    if (data.typeOfOccurrence) summary.push(`Type: ${data.typeOfOccurrence}`);
    if (data.occDate || data.occTime) summary.push(`When: ${data.occDate || ''} ${data.occTime || ''}`.trim());
    if (data.occLocation) summary.push(`Location: ${data.occLocation}`);
    if (data.details) summary.push(`Details: ${data.details}`);

    const payload = {
      reportType: 'or',
      description: summary.join('\n'),
      aircraftType: undefined,
      flightNumber: undefined,
      eventDateTime: data.occDate ? new Date(`${data.occDate}T${data.occTime || '00:00'}:00`).toISOString() : undefined,
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
      toast({ title: 'Submitted', description: 'Occurrence Report created successfully' });
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
          <h1 className="text-xl sm:text-2xl font-semibold">Occurrence Report to QA (OR)</h1>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm">A/C Reg.</label>
                <Input {...register('acReg')} />
              </div>
              <div>
                <label className="text-sm">Date</label>
                <Input type="date" {...register('headerDate')} />
              </div>
              <div>
                <label className="text-sm">Report Ref.</label>
                <Input placeholder="(by QC Office)" {...register('reportRef')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm">Date of Occurrence</label>
                <Input type="date" {...register('occDate')} />
              </div>
              <div>
                <label className="text-sm">Time</label>
                <Input type="time" {...register('occTime')} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm">Location</label>
                <Input {...register('occLocation')} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Type of Occurrence</label>
              <Input {...register('typeOfOccurrence')} />
            </div>

            <div>
              <label className="text-sm font-medium">Name(s) of staff involved</label>
              <Textarea rows={4} {...register('staffInvolved')} />
            </div>

            <div>
              <label className="text-sm font-medium">Detail and Circumstances of Occurrence</label>
              <Textarea rows={6} {...register('details')} />
            </div>

            <div>
              <label className="text-sm font-medium">Extent of damage or injury to personnel, if any</label>
              <Textarea rows={4} {...register('damageExtent')} />
            </div>

            <div>
              <label className="text-sm font-medium">Rectification action taken, if any</label>
              <Textarea rows={4} {...register('rectification')} />
            </div>

            <div>
              <label className="text-sm font-medium">Remarks / Comments</label>
              <Textarea rows={4} {...register('remarks')} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Quality Assurance Engineer</label>
                <Input {...register('qaEngineer')} />
              </div>
              <div>
                <label className="text-sm">Date</label>
                <Input type="date" {...register('qaDate')} />
              </div>
            </div>
          </Card>

          <div className="flex justify-center sm:justify-end">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-8">
              {isSubmitting ? 'Submitting...' : 'Submit OR'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


