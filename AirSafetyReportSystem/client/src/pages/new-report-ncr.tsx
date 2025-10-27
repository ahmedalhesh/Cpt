import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const schema = z.object({
  // معلومات عامة
  date: z.string().optional(),
  flightDate: z.string().optional(),
  flightNumber: z.string().optional(),
  aircraftType: z.string().optional(),
  aircraftReg: z.string().optional(),
  captainName: z.string().optional(),
  foName: z.string().optional(),

  // مصادر عدم المطابقة
  srcSurvey: z.boolean().optional(),
  srcCustomerComplaint: z.boolean().optional(),
  srcPilotObservation: z.boolean().optional(),
  srcMaintenanceOfficer: z.boolean().optional(),
  srcOtherMonitoring: z.boolean().optional(),
  srcInternalAudit: z.boolean().optional(),
  srcOpsTax: z.boolean().optional(),
  srcOtherText: z.string().optional(),

  // نوع عدم المطابقة
  nonconform_service: z.boolean().optional(),
  nonconform_safety: z.boolean().optional(),
  nonconform_security: z.boolean().optional(),

  // تفاصيل
  nonconformDetails: z.string().optional(),
  recommendationFix: z.string().optional(),
  recommendationAction: z.string().optional(),
  discovererName: z.string().optional(),
  discovererTitle: z.string().optional(),
  discovererDate: z.string().optional(),

  // تحليل الأسباب الرئيسية
  rootCauseAnalysis: z.string().optional(),
  analystName: z.string().optional(),
  analystTitle: z.string().optional(),
  analystDate: z.string().optional(),

  // تقرير السلامة/الأمن/الخدمة غير المطابقة
  directManagerNotes: z.string().optional(),
  needsCorrection: z.enum(["yes", "no"]).optional(),
  correctionDetails: z.string().optional(),
  correctionDueDate: z.string().optional(),
  personAssignedName: z.string().optional(),
  personAssignedTitle: z.string().optional(),
  executorName: z.string().optional(),
  executorTitle: z.string().optional(),
  proposalNotes: z.string().optional(),
  proposalApprove: z.enum(["yes", "no"]).optional(),
  proposalSignerName: z.string().optional(),
  proposalSignerTitle: z.string().optional(),
  proposalSignerDate: z.string().optional(),

  // نتائج التصحيح والمتابعة
  correctionResultDetails: z.string().optional(),
  correctionResponsibleDate: z.string().optional(),
  followupDate: z.string().optional(),
  followupResult: z.string().optional(),
  reportClosureNotes: z.string().optional(),
  closureDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewReportNCR() {
  const { user } = useAuth();
  const canCreate = useMemo(() => user?.role === 'captain' || user?.role === 'first_officer', [user?.role]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const toggle = (key: keyof FormData) => setValue(key, !watch(key as any) as any);

  const onSubmit = async (data: FormData) => {
    if (!canCreate) {
      toast({ title: 'غير مسموح', description: 'المشرف لا يمكنه إنشاء تقارير', variant: 'destructive' });
      return;
    }

    // نبني الوصف النصي (لعرض سريع داخل التفاصيل)
    const lines: string[] = [];
    lines.push('تقرير عدم مطابقة (NCR)');
    if (data.flightNumber) lines.push(`رقم الرحلة: ${data.flightNumber}`);
    if (data.flightDate) lines.push(`تاريخ الرحلة: ${data.flightDate}`);
    if (data.aircraftType) lines.push(`نوع الطائرة: ${data.aircraftType}`);
    if (data.nonconformDetails) lines.push(`تفاصيل: ${data.nonconformDetails}`);

    const payload = {
      reportType: 'ncr',
      description: lines.join('\n'),
      flightNumber: data.flightNumber,
      aircraftType: data.aircraftType,
      eventDateTime: data.flightDate ? new Date(`${data.flightDate}T00:00:00`).toISOString() : undefined,
      // نخزن بقية الحقول كـ extraData لسهولة العرض لاحقاً
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
      toast({ title: 'تم الإرسال', description: 'تم إنشاء تقرير عدم المطابقة بنجاح' });
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2 sm:mb-3">
          <h1 className="text-xl sm:text-2xl font-semibold">نموذج عدم المطابقة (NCR)</h1>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <a href="/reports">Back to Reports</a>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {/* معلومات عامة */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">المعلومات العامة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">التاريخ</label>
                <Input type="date" {...register('date')} />
              </div>
              <div>
                <label className="text-sm">تاريخ الرحلة</label>
                <Input type="date" {...register('flightDate')} />
              </div>
              <div>
                <label className="text-sm">رقم الرحلة</label>
                <Input {...register('flightNumber')} />
              </div>
              <div>
                <label className="text-sm">نوع الطائرة</label>
                <Input {...register('aircraftType')} />
              </div>
              <div>
                <label className="text-sm">رقم تسجيل الطائرة</label>
                <Input {...register('aircraftReg')} />
              </div>
              <div>
                <label className="text-sm">اسم قائد الطائرة</label>
                <Input {...register('captainName')} />
              </div>
              <div>
                <label className="text-sm">اسم مساعد قائد الطائرة</label>
                <Input {...register('foName')} />
              </div>
            </div>
          </Card>

          {/* مصادر وتفاصيل ونوع عدم المطابقة */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">مصدر وتفاصيل ونوع عدم المطابقة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('srcSurvey')} onCheckedChange={() => toggle('srcSurvey')} /> استبيانات مسح رضى العملاء</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('srcCustomerComplaint')} onCheckedChange={() => toggle('srcCustomerComplaint')} /> شكوى عميل</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('srcPilotObservation')} onCheckedChange={() => toggle('srcPilotObservation')} /> ملاحظات مراقبة من الطيار</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('srcMaintenanceOfficer')} onCheckedChange={() => toggle('srcMaintenanceOfficer')} /> ضابط الصيانة</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('srcOtherMonitoring')} onCheckedChange={() => toggle('srcOtherMonitoring')} /> نشاطات مراقبة أخرى</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('srcInternalAudit')} onCheckedChange={() => toggle('srcInternalAudit')} /> الفحص الداخلي</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('srcOpsTax')} onCheckedChange={() => toggle('srcOpsTax')} /> أداء ضريبة العمليات</label>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-sm">مصادر أخرى</label>
                  <Input placeholder="أخرى (حدد)" {...register('srcOtherText')} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">نوع عدم المطابقة</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('nonconform_service')} onCheckedChange={() => toggle('nonconform_service')} /> الخدمية</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('nonconform_safety')} onCheckedChange={() => toggle('nonconform_safety')} /> تؤثر على السلامة</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!watch('nonconform_security')} onCheckedChange={() => toggle('nonconform_security')} /> تؤثر على الأمن</label>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">تفاصيل عدم المطابقة</label>
              <Textarea rows={6} {...register('nonconformDetails')} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">التوصية بخصوص التصحيح اللازم (رجاءً اذكر)</label>
                <Textarea rows={5} {...register('recommendationFix')} />
              </div>
              <div>
                <label className="text-sm font-medium">التوصية بخصوص الإجراء التصحيحي اللازم (رجاءً اذكر)</label>
                <Textarea rows={5} {...register('recommendationAction')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">اسم مكتشف الخدمة غير المطابقة</label>
                <Input {...register('discovererName')} />
              </div>
              <div>
                <label className="text-sm">الوظيفة</label>
                <Input {...register('discovererTitle')} />
              </div>
              
              <div>
                <label className="text-sm">التاريخ</label>
                <Input type="date" {...register('discovererDate')} />
              </div>
            </div>
          </Card>

          {/* تحليل الأسباب الرئيسية */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">تحليل الأسباب الرئيسية لحالة عدم المطابقة</h2>
            <Textarea rows={8} {...register('rootCauseAnalysis')} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">اسم ووظيفة الشخص الذي حدد الأسباب الرئيسية</label>
                <Input {...register('analystTitle')} />
              </div>
              <div>
                <label className="text-sm">الاسم</label>
                <Input {...register('analystName')} />
              </div>
              
              <div>
                <label className="text-sm">التاريخ</label>
                <Input type="date" {...register('analystDate')} />
              </div>
            </div>
          </Card>

          {/* تقرير السلامة/الأمن/الخدمة غير المطابقة */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">تقرير السلامة/الأمن/الخدمة غير المطابقة</h2>
            <div>
              <label className="text-sm">ملاحظات المسؤول المباشر</label>
              <Textarea rows={5} {...register('directManagerNotes')} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <label className="flex items-center gap-2 col-span-2 sm:col-span-1"><input type="radio" value="yes" {...register('needsCorrection')} /> الحالة تحتاج إلى تصحيح</label>
              <label className="flex items-center gap-2 col-span-2 sm:col-span-1"><input type="radio" value="no" {...register('needsCorrection')} /> الحالة لا تحتاج إلى تصحيح</label>
            </div>
            <div>
              <label className="text-sm">تفاصيل التصحيح (عند الحاجة له)</label>
              <Textarea rows={5} {...register('correctionDetails')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">التاريخ المطلوب لإنهاء التصحيح</label>
                <Input type="date" {...register('correctionDueDate')} />
              </div>
              <div>
                <label className="text-sm">اسم ووظيفة الشخص الذي حُدد لتنفيذ التصحيح</label>
                <Input {...register('personAssignedTitle')} />
              </div>
              <div>
                <label className="text-sm">الاسم</label>
                <Input {...register('personAssignedName')} />
              </div>
              
            </div>
          </Card>

          {/* الملاحظات على الإجراء التصحيحي المقترح */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">الملاحظات على الإجراء التصحيحي المقترح</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <label className="flex items-center gap-2 col-span-2 sm:col-span-1"><input type="radio" value="yes" {...register('proposalApprove')} /> أقرّح القيام بإجراء تصحيحي</label>
              <label className="flex items-center gap-2 col-span-2 sm:col-span-1"><input type="radio" value="no" {...register('proposalApprove')} /> لا أقرّح القيام بإجراء تصحيحي</label>
            </div>
            <div>
              <label className="text-sm">ملاحظات المسؤول المباشر</label>
              <Textarea rows={5} {...register('proposalNotes')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">اسم الشخص الذي أقرّ الإجراء التصحيحي</label>
                <Input {...register('proposalSignerName')} />
              </div>
              <div>
                <label className="text-sm">وظيفته</label>
                <Input {...register('proposalSignerTitle')} />
              </div>
              <div>
                <label className="text-sm">التاريخ</label>
                <Input type="date" {...register('proposalSignerDate')} />
              </div>
            </div>
          </Card>

          {/* نتائج التصحيح */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">نتائج التصحيح</h2>
            <Textarea rows={6} {...register('correctionResultDetails')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              <div>
                <label className="text-sm">التاريخ</label>
                <Input type="date" {...register('correctionResponsibleDate')} />
              </div>
            </div>
          </Card>

          {/* نتائج المتابعة وإغلاق التقرير */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">نتائج المتابعة وإغلاق التقرير</h2>
            <div>
              <label className="text-sm">نتائج المتابعة</label>
              <Textarea rows={5} {...register('followupResult')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">تاريخ المتابعة</label>
                <Input type="date" {...register('followupDate')} />
              </div>
            </div>
            <div>
              <label className="text-sm">إغلاق التقرير (إن تمّت عن الشخص المُسند في هذه المهمة)</label>
              <Textarea rows={4} {...register('reportClosureNotes')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm">تاريخ الإغلاق</label>
                <Input type="date" {...register('closureDate')} />
              </div>
              
            </div>
          </Card>

          <div className="flex justify-center sm:justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-8">
              {isSubmitting ? 'جاري الإرسال...' : 'إرسال تقرير عدم المطابقة'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


