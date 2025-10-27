import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReportTypeBadge } from "@/components/report-type-badge";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  MessageSquare, 
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import type { Report, Comment, User as UserType } from "@shared/schema";

type ReportWithUser = Report & {
  submitter: UserType;
  comments: (Comment & { user: UserType })[];
  // Optional extra fields sent by client for ASR plots
  planImage?: string; // base64 PNG
  elevImage?: string; // base64 PNG
  planUnits?: string;
  planGridX?: number;
  planGridY?: number;
  planDistanceX?: number;
  planDistanceY?: number;
  elevGridCol?: number;
  elevGridRow?: number;
  elevDistanceHorizM?: number;
  elevDistanceVertFt?: number;
  // Generic container for additional form data (e.g., NCR Arabic form)
  extraData?: any;
};

export default function ReportDetail() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/reports/:id");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: report, isLoading } = useQuery<ReportWithUser>({
    queryKey: ["/api/reports", params?.id],
    enabled: !!params?.id,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", "/api/comments", {
        reportId: params?.id,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", params?.id] });
      setCommentText("");
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      console.log(`🔄 [CLIENT] Starting status update: ${newStatus} for report ${params?.id}`);
      console.log(`🔄 [CLIENT] User role: ${user?.role}, User ID: ${user?.id}`);
      console.log(`🔄 [CLIENT] Current report status: ${report?.status}`);
      
      try {
        const response = await apiRequest("PATCH", `/api/reports/${params?.id}/status`, { status: newStatus });
        console.log(`✅ [CLIENT] API request successful, status: ${response.status}`);
        
        const result = await response.json();
        console.log(`✅ [CLIENT] Response data:`, result);
        return result;
      } catch (error) {
        console.error(`❌ [CLIENT] API request failed:`, error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log(`✅ [CLIENT] Mutation successful, invalidating queries...`);
      queryClient.invalidateQueries({ queryKey: ["/api/reports", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/stats"] });
      console.log(`✅ [CLIENT] Queries invalidated, showing success toast`);
      
      toast({
        title: "Status updated",
        description: "Report status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error(`❌ [CLIENT] Mutation failed:`, error);
      console.error(`❌ [CLIENT] Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      if (isUnauthorizedError(error)) {
        console.log(`🔐 [CLIENT] Unauthorized error detected, redirecting to login`);
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      console.log(`❌ [CLIENT] Showing error toast: ${error.message}`);
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleAddComment = () => {
    if (commentText.trim()) {
      addCommentMutation.mutate(commentText);
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  const generatePDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;
      
      const element = document.getElementById('report-content');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`ASR-Report-${report?.id.slice(0, 8)}.pdf`);
      
      toast({
        title: "PDF Generated",
        description: "Report has been exported as PDF successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const canUpdateStatus = user?.role === 'admin';

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-5xl mx-auto p-6 lg:p-8">
        <Button variant="ghost" asChild className="mb-6" data-testid="button-back">
          <Link href="/reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Link>
        </Button>

        {isLoading ? (
          <div className="space-y-6">
            <Card className="p-8">
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          </div>
        ) : report ? (
          <>
            {/* Report Header */}
            <Card className="p-8 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="flex flex-wrap gap-3">
                  <ReportTypeBadge type={report.reportType} />
                  <StatusBadge status={report.status} />
                </div>
                <p className="text-sm font-mono text-muted-foreground" data-testid="text-report-id">
                  #{report.id.slice(0, 12)}
                </p>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight mb-4">
                {report.reportType.toUpperCase()} Report
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{report.createdAt ? format(new Date(report.createdAt), 'PPP') : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  {report.isAnonymous === 1 ? (
                    <span>Anonymous Report</span>
                  ) : (
                    <span>
                      {report.submitter?.firstName && report.submitter?.lastName
                        ? `${report.submitter.firstName} ${report.submitter.lastName}`
                        : report.submitter?.email || "Unknown"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  <span>{report.comments?.length || 0} Comments</span>
                </div>
              </div>
            </Card>

            {/* Report Details */}
            <Card className="p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                <h2 className="text-lg font-semibold">Report Details</h2>
                <Button
                  onClick={() => generatePDF()}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
              
              <div className="space-y-4" id="report-content">
                {/* Basic Information */}
                {report.flightNumber && (
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <label className="text-sm font-bold text-blue-700 uppercase tracking-wide">Flight Number</label>
                    <p className="text-sm mt-1 font-mono">{report.flightNumber}</p>
                  </div>
                )}

                {report.aircraftType && (
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <label className="text-sm font-bold text-blue-700 uppercase tracking-wide">Aircraft Type</label>
                    <p className="text-sm mt-1">{report.aircraftType}</p>
                  </div>
                )}

                {report.route && (
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <label className="text-sm font-bold text-blue-700 uppercase tracking-wide">Route</label>
                    <p className="text-sm mt-1">{report.route}</p>
                  </div>
                )}

                {report.eventDateTime && (
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <label className="text-sm font-bold text-blue-700 uppercase tracking-wide">Event Date & Time</label>
                    <p className="text-sm mt-1">{format(new Date(report.eventDateTime), 'PPpp')}</p>
                  </div>
                )}

                {/* Description */}
                {report.description && (
                  <div className="border-l-4 border-green-500 pl-4 py-2">
                    <label className="text-sm font-bold text-green-700 uppercase tracking-wide">Description</label>
                    <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{report.description}</p>
                  </div>
                )}

                {/* Contributing Factors */}
                {report.contributingFactors && (
                  <div className="border-l-4 border-orange-500 pl-4 py-2">
                    <label className="text-sm font-bold text-orange-700 uppercase tracking-wide">Contributing Factors</label>
                    <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{report.contributingFactors}</p>
                  </div>
                )}

                {/* Corrective Actions */}
                {report.correctiveActions && (
                  <div className="border-l-4 border-purple-500 pl-4 py-2">
                    <label className="text-sm font-bold text-purple-700 uppercase tracking-wide">Corrective Actions</label>
                    <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{report.correctiveActions}</p>
                  </div>
                )}

                {/* Location */}
                {report.location && (
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <label className="text-sm font-bold text-blue-700 uppercase tracking-wide">Location</label>
                    <p className="text-sm mt-1">{report.location}</p>
                  </div>
                )}

                {/* Risk Level */}
                {report.riskLevel && (
                  <div className="border-l-4 border-red-500 pl-4 py-2">
                    <label className="text-sm font-bold text-red-700 uppercase tracking-wide">Risk Level</label>
                    <p className="text-sm mt-1 capitalize font-semibold">{report.riskLevel}</p>
                  </div>
                )}

                {/* ASR Plots */}
                {(report.planImage || report.elevImage) && (
                  <div className="border-l-4 border-indigo-500 pl-4 py-2">
                    <label className="text-sm font-bold text-indigo-700 uppercase tracking-wide">ASR Plots</label>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                      {report.planImage && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm font-semibold text-gray-700 mb-2">VIEW FROM ABOVE</div>
                          <img src={report.planImage} alt="Plan view" className="w-full h-auto rounded border shadow-sm" />
                          {(report.planUnits || report.planDistanceX !== undefined || report.planDistanceY !== undefined) && (
                            <div className="text-xs text-gray-600 mt-2">
                              {report.planUnits && `Units: ${report.planUnits}`}
                              {report.planDistanceX !== undefined && report.planDistanceY !== undefined && (
                                <>
                                  {report.planUnits ? ' · ' : ''}
                                  DX: {report.planDistanceX} {report.planUnits?.toLowerCase()} · DY: {report.planDistanceY} {report.planUnits?.toLowerCase()}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {report.elevImage && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm font-semibold text-gray-700 mb-2">VIEW FROM ASTERN</div>
                          <img src={report.elevImage} alt="Elevation view" className="w-full h-auto rounded border shadow-sm" />
                          {(report.elevDistanceHorizM !== undefined || report.elevDistanceVertFt !== undefined) && (
                            <div className="text-xs text-gray-600 mt-2">
                              {report.elevDistanceHorizM !== undefined && `Horiz: ${report.elevDistanceHorizM} m`}
                              {report.elevDistanceVertFt !== undefined && ` · Vert: ${report.elevDistanceVertFt} ft`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* NCR Arabic Details */}
                {report.reportType === 'ncr' && report.extraData && (
                  <div dir="rtl" className="border-l-4 border-teal-500 pl-4 py-2">
                    <label className="text-sm font-bold text-teal-700 uppercase tracking-wide">تفاصيل عدم المطابقة (NCR)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-right">
                      {report.extraData.flightNumber && (
                        <div>
                          <div className="text-xs text-muted-foreground">رقم الرحلة</div>
                          <div className="text-sm font-medium">{report.extraData.flightNumber}</div>
                        </div>
                      )}
                      {report.extraData.flightDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">تاريخ الرحلة</div>
                          <div className="text-sm font-medium">{report.extraData.flightDate}</div>
                        </div>
                      )}
                      {report.extraData.aircraftType && (
                        <div>
                          <div className="text-xs text-muted-foreground">نوع الطائرة</div>
                          <div className="text-sm font-medium">{report.extraData.aircraftType}</div>
                        </div>
                      )}
                      {report.extraData.aircraftReg && (
                        <div>
                          <div className="text-xs text-muted-foreground">تسجيل الطائرة</div>
                          <div className="text-sm font-medium">{report.extraData.aircraftReg}</div>
                        </div>
                      )}
                    </div>

                    {report.extraData.nonconformDetails && (
                      <div className="mt-4">
                        <div className="text-xs text-muted-foreground">تفاصيل عدم المطابقة</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.nonconformDetails}</div>
                      </div>
                    )}

                    {(report.extraData.recommendationFix || report.extraData.recommendationAction) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {report.extraData.recommendationFix && (
                          <div>
                            <div className="text-xs text-muted-foreground">التوصية بخصوص التصحيح اللازم</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.recommendationFix}</div>
                          </div>
                        )}
                        {report.extraData.recommendationAction && (
                          <div>
                            <div className="text-xs text-muted-foreground">التوصية بخصوص الإجراء التصحيحي</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.recommendationAction}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* نتائج التصحيح / المتابعة */}
                    {(report.extraData.correctionResultDetails || report.extraData.followupResult) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {report.extraData.correctionResultDetails && (
                          <div>
                            <div className="text-xs text-muted-foreground">نتائج التصحيح</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.correctionResultDetails}</div>
                          </div>
                        )}
                        {report.extraData.followupResult && (
                          <div>
                            <div className="text-xs text-muted-foreground">نتائج المتابعة</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.followupResult}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* OR Details */}
                {report.reportType === 'or' && report.extraData && (
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <label className="text-sm font-bold text-blue-700 uppercase tracking-wide">Occurrence Report (OR)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {report.extraData.typeOfOccurrence && (
                        <div>
                          <div className="text-xs text-muted-foreground">Type of Occurrence</div>
                          <div className="text-sm font-medium">{report.extraData.typeOfOccurrence}</div>
                        </div>
                      )}
                      {(report.extraData.occDate || report.extraData.occTime) && (
                        <div>
                          <div className="text-xs text-muted-foreground">Date / Time</div>
                          <div className="text-sm font-medium">{report.extraData.occDate || '—'} {report.extraData.occTime || ''}</div>
                        </div>
                      )}
                      {report.extraData.occLocation && (
                        <div>
                          <div className="text-xs text-muted-foreground">Location</div>
                          <div className="text-sm font-medium">{report.extraData.occLocation}</div>
                        </div>
                      )}
                      {report.extraData.staffInvolved && (
                        <div className="md:col-span-2">
                          <div className="text-xs text-muted-foreground">Staff involved</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.staffInvolved}</div>
                        </div>
                      )}
                      {report.extraData.details && (
                        <div className="md:col-span-2">
                          <div className="text-xs text-muted-foreground">Details</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.details}</div>
                        </div>
                      )}
                      {report.extraData.damageExtent && (
                        <div className="md:col-span-2">
                          <div className="text-xs text-muted-foreground">Damage/Injury</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.damageExtent}</div>
                        </div>
                      )}
                      {report.extraData.rectification && (
                        <div className="md:col-span-2">
                          <div className="text-xs text-muted-foreground">Rectification</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.rectification}</div>
                        </div>
                      )}
                      {report.extraData.remarks && (
                        <div className="md:col-span-2">
                          <div className="text-xs text-muted-foreground">Remarks</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.remarks}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CDF Details */}
                {report.reportType === 'cdf' && report.extraData && (
                  <div className="border-l-4 border-amber-500 pl-4 py-2">
                    <label className="text-sm font-bold text-amber-700 uppercase tracking-wide">Commander's Discretion (CDF)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {report.extraData.type && (
                        <div>
                          <div className="text-xs text-muted-foreground">Type</div>
                          <div className="text-sm font-medium">{report.extraData.type === 'extension' ? 'Extension of FDP/FH' : 'Reduction of Rest'}</div>
                        </div>
                      )}
                      {report.extraData.remarksActionTaken && (
                        <div className="md:col-span-2">
                          <div className="text-xs text-muted-foreground">Remarks / Action Taken</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.remarksActionTaken}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CHR Details (Arabic) */}
                {report.reportType === 'chr' && report.extraData && (
                  <div dir="rtl" className="border-l-4 border-fuchsia-500 pl-4 py-2">
                    <label className="text-sm font-bold text-fuchsia-700 uppercase tracking-wide">تقرير خطر/واقعة (CHR)</label>
                    {report.extraData.hazardDescription && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground">وصف الخطر</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.hazardDescription}</div>
                      </div>
                    )}
                    {report.extraData.recommendations && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground">التوصيات</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.recommendations}</div>
                      </div>
                    )}
                    {report.extraData.followUpActionTaken && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground">الإجراء المتخذ</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.followUpActionTaken}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* RIR Details */}
                {report.reportType === 'rir' && report.extraData && (
                  <div className="border-l-4 border-emerald-500 pl-4 py-2">
                    <label className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Ramp Incident Report (RIR)</label>
                    {report.extraData.incidentTitle && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground">Incident Title</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.incidentTitle}</div>
                      </div>
                    )}
                    {report.extraData.typeOfOccurrence && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground">Type of Occurrence</div>
                        <div className="text-sm leading-relaxed">{report.extraData.typeOfOccurrence}</div>
                      </div>
                    )}
                    {report.extraData.remarks && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground">Remarks</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{report.extraData.remarks}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Admin Status Actions */}
            {canUpdateStatus && (
              <Card className="p-6 mb-6 border-l-4 border-l-blue-500">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold">Admin Actions</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  As an administrator, you can approve or reject this report.
                </p>
                <div className="flex flex-wrap gap-3">
                  {report.status === 'submitted' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate('in_review')}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-move-to-review"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Start Review
                    </Button>
                  )}
                  {report.status === 'in_review' && (
                    <>
                      <Button
                        onClick={() => updateStatusMutation.mutate('closed')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-close-report"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve & Close
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => updateStatusMutation.mutate('rejected')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-reject-report"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Report
                      </Button>
                    </>
                  )}
                  {(report.status === 'closed' || report.status === 'rejected') && (
                    <div className="text-sm text-muted-foreground">
                      This report has been {report.status === 'closed' ? 'approved and closed' : 'rejected'}.
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Comments Section */}
            <Card className="p-8">
              <h2 className="text-lg font-semibold mb-6">Comments & Discussion</h2>
              
              {/* Add Comment */}
              <div className="mb-8">
                <Textarea
                  placeholder="Add a comment or follow-up..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="mb-3"
                  rows={3}
                  data-testid="textarea-comment"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  data-testid="button-send-comment"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
                </Button>
              </div>

              <Separator className="mb-6" />

              {/* Comments List */}
              {report.comments && report.comments.length > 0 ? (
                <div className="space-y-6">
                  {report.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-4" data-testid={`comment-${comment.id}`}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comment.user?.profileImageUrl || undefined} className="object-cover" />
                        <AvatarFallback>
                          {getInitials(comment.user?.firstName, comment.user?.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="bg-muted rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium">
                              {comment.user?.firstName && comment.user?.lastName
                                ? `${comment.user.firstName} ${comment.user.lastName}`
                                : comment.user?.email || "Unknown User"}
                            </p>
                            {comment.createdAt && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.createdAt), 'PPp')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
                </div>
              )}
            </Card>
          </>
        ) : (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Report not found</p>
            <Button asChild data-testid="button-back-to-reports">
              <Link href="/reports">Back to Reports</Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
