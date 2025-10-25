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
} from "lucide-react";
import { format } from "date-fns";
import type { Report, Comment, User as UserType } from "@shared/schema";

type ReportWithUser = Report & {
  submitter: UserType;
  comments: (Comment & { user: UserType })[];
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
      await apiRequest("PATCH", `/api/reports/${params?.id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/stats"] });
      toast({
        title: "Status updated",
        description: "Report status has been updated successfully.",
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
        description: "Failed to update status. Please try again.",
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

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const canUpdateStatus = user?.role === 'safety_officer' || user?.role === 'administrator';

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
            <Card className="p-8 mb-6">
              <h2 className="text-lg font-semibold mb-4">Report Details</h2>
              
              <div className="space-y-6">
                {report.flightNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Flight Number</label>
                    <p className="text-sm mt-1 font-mono">{report.flightNumber}</p>
                  </div>
                )}

                {report.aircraftType && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Aircraft Type</label>
                    <p className="text-sm mt-1">{report.aircraftType}</p>
                  </div>
                )}

                {report.route && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Route</label>
                    <p className="text-sm mt-1">{report.route}</p>
                  </div>
                )}

                {report.eventDateTime && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Event Date & Time</label>
                    <p className="text-sm mt-1">{format(new Date(report.eventDateTime), 'PPpp')}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                  <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{report.description}</p>
                </div>

                {report.contributingFactors && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Contributing Factors</label>
                    <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{report.contributingFactors}</p>
                  </div>
                )}

                {report.correctiveActions && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Corrective Actions</label>
                    <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{report.correctiveActions}</p>
                  </div>
                )}

                {report.location && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Location</label>
                    <p className="text-sm mt-1">{report.location}</p>
                  </div>
                )}

                {report.riskLevel && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Risk Level</label>
                    <p className="text-sm mt-1 capitalize">{report.riskLevel}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Status Actions */}
            {canUpdateStatus && report.status !== 'closed' && report.status !== 'rejected' && (
              <Card className="p-6 mb-6">
                <h3 className="text-sm font-semibold mb-4">Update Status</h3>
                <div className="flex flex-wrap gap-3">
                  {report.status === 'submitted' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate('in_review')}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-move-to-review"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Move to Review
                    </Button>
                  )}
                  {report.status === 'in_review' && (
                    <>
                      <Button
                        onClick={() => updateStatusMutation.mutate('closed')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-close-report"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Close Report
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
