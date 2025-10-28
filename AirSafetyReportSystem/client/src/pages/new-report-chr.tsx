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

// Confidential Hazard / Occurrence Report (CHR) — Arabic/English
const schema = z.object({
  reportRef: z.string().optional(),
  isAnonymous: z.boolean().optional(),

  hazardDescription: z.string().optional(), // All fields are optional
  recommendations: z.string().optional(),

  reporterName: z.string().optional(),
  reporterPosition: z.string().optional(),
  reporterIdNo: z.string().optional(),
  
  reporterDate: z.string().optional(),

  validationNotes: z.string().optional(),
  safetyOfficerName: z.string().optional(),
  
  safetyOfficerDate: z.string().optional(),

  correctiveActionNotes: z.string().optional(),
  correctiveName: z.string().optional(),
  
  correctiveDate: z.string().optional(),

  followUpActionTaken: z.string().optional(),
  followUpDecision: z.enum(["SAT", "UNSAT", "NEXT_AUDIT"]).optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewReportCHR() {
  const { user } = useAuth();
  const canCreate = useMemo(() => user?.role === 'captain' || user?.role === 'first_officer', [user?.role]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { register, handleSubmit, setValue, watch, formState: { isSubmitting, errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isAnonymous: false },
  });

  const onSubmit = async (data: FormData) => {
    if (!canCreate) {
      toast({ title: 'غير مسموح', description: 'المشرف لا يمكنه إنشاء تقارير', variant: 'destructive' });
      return;
    }

    const lines: string[] = [];
    lines.push('Confidential Hazard / Occurrence Report (CHR)');
    if (data.reportRef) lines.push(`Report ref: ${data.reportRef}`);
    if (data.hazardDescription) lines.push(`Hazard: ${data.hazardDescription}`);
    if (data.recommendations) lines.push(`Recommendations: ${data.recommendations}`);

    const payload = {
      reportType: 'chr',
      description: lines.join('\n'),
      flightNumber: undefined,
      aircraftType: undefined,
      eventDateTime: data.reporterDate ? new Date(`${data.reporterDate}T00:00:00`).toISOString() : undefined,
      isAnonymous: data.isAnonymous ? 1 : 0,
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
        throw new Error(err.message || 'فشل إنشاء التقرير');
      }
      const created = await res.json();
      toast({ title: 'تم الإرسال', description: 'تم إنشاء تقرير CHR بنجاح' });
      setLocation(`/reports/${created.id}`);
    } catch (e: any) {
      toast({ title: 'فشل الإرسال', description: e.message || 'حاول مرة أخرى', variant: 'destructive' });
    }
  };

  if (!canCreate) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="container max-w-5xl mx-auto p-6">
          <Card className="p-6">المشرف لا يمكنه إنشاء تقارير.</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto" dir="rtl">
      <div className="container max-w-6xl mx-auto p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h1 className="text-xl sm:text-2xl font-semibold">تقرير خطر أو واقعة (CHR)</h1>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-sm">رقم المرجع</label>
                <Input {...register('reportRef')} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!watch('isAnonymous')} onCheckedChange={(v) => setValue('isAnonymous', !!v)} />
                إرسال التقرير كمجهول الهوية
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">وصف مختصر لمصدر الخطر</label>
                <Textarea rows={8} {...register('hazardDescription')} />
                {errors.hazardDescription && <p className="text-xs text-destructive mt-1">{errors.hazardDescription.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">مقترحات وتوصيات للتصحيح (إن وجدت)</label>
                <Textarea rows={8} {...register('recommendations')} />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">بيانات المبلّغ</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">الاسم</label>
                <Input {...register('reporterName')} />
              </div>
              <div>
                <label className="text-sm">الوظيفة</label>
                <Input {...register('reporterPosition')} />
              </div>
              <div>
                <label className="text-sm">الرقم الوظيفي</label>
                <Input {...register('reporterIdNo')} />
              </div>
              
              <div>
                <label className="text-sm">التاريخ</label>
                <Input type="date" {...register('reporterDate')} />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">التحقيق والتوصيات (ضابط السلامة)</h2>
            <Textarea rows={6} {...register('validationNotes')} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">اسم ضابط السلامة</label>
                <Input {...register('safetyOfficerName')} />
              </div>
              
              <div>
                <label className="text-sm">التاريخ</label>
                <Input type="date" {...register('safetyOfficerDate')} />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">الإجراءات التصحيحية المنفذة (الجهة المعنية)</h2>
            <Textarea rows={6} {...register('correctiveActionNotes')} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">الاسم</label>
                <Input {...register('correctiveName')} />
              </div>
              
              <div>
                <label className="text-sm">التاريخ</label>
                <Input type="date" {...register('correctiveDate')} />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">متابعات مكتب السلامة</h2>
            <div>
              <label className="text-sm">الإجراء المتخذ</label>
              <Textarea rows={4} {...register('followUpActionTaken')} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>القرار:</span>
              <label className="flex items-center gap-2"><input type="radio" value="SAT" {...register('followUpDecision')} /> SAT? مقبول؟</label>
              <label className="flex items-center gap-2"><input type="radio" value="UNSAT" {...register('followUpDecision')} /> UNSAT غير مقبول</label>
              <label className="flex items-center gap-2"><input type="radio" value="NEXT_AUDIT" {...register('followUpDecision')} /> NEXT AUDIT التدقيق القادم</label>
            </div>
          </Card>

          <div className="flex justify-center sm:justify-end">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-8">
              {isSubmitting ? 'جاري الإرسال...' : 'إرسال تقرير CHR'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


