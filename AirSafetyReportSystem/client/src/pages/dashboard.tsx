import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Plus,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportStats } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: stats, isLoading } = useQuery<ReportStats>({
    queryKey: ["/api/reports/stats"],
  });

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            {user?.role === 'admin' ? 'Admin Dashboard' : 'My Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'admin' 
              ? 'Overview of all aviation safety reports and system activity'
              : 'Overview of your submitted reports and their status'
            }
          </p>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-10 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            {user?.role === 'admin' ? (
              // Admin Dashboard Stats
              <>
                <StatCard
                  title="Total Reports"
                  value={stats?.total || 0}
                  icon={FileText}
                  subtitle="All system reports"
                />
                <StatCard
                  title="Pending Review"
                  value={stats?.byStatus?.in_review || 0}
                  icon={Clock}
                  subtitle="Awaiting your review"
                />
                <StatCard
                  title="Resolved"
                  value={stats?.byStatus?.closed || 0}
                  icon={CheckCircle2}
                  subtitle="Successfully closed"
                />
                <StatCard
                  title="New Submissions"
                  value={stats?.byStatus?.submitted || 0}
                  icon={AlertTriangle}
                  subtitle="Require immediate attention"
                />
                <StatCard
                  title="Rejected"
                  value={stats?.byStatus?.rejected || 0}
                  icon={XCircle}
                  subtitle="Reports that were rejected"
                />
              </>
            ) : (
              // User Dashboard Stats
              <>
                <StatCard
                  title="My Reports"
                  value={stats?.total || 0}
                  icon={FileText}
                  subtitle="Reports I submitted"
                />
                <StatCard
                  title="Under Review"
                  value={stats?.byStatus?.in_review || 0}
                  icon={Clock}
                  subtitle="Being reviewed by admin"
                />
                <StatCard
                  title="Approved"
                  value={stats?.byStatus?.closed || 0}
                  icon={CheckCircle2}
                  subtitle="Successfully approved"
                />
                <StatCard
                  title="Recent"
                  value={stats?.byStatus?.submitted || 0}
                  icon={AlertTriangle}
                  subtitle="Recently submitted"
                />
                <StatCard
                  title="Rejected"
                  value={stats?.byStatus?.rejected || 0}
                  icon={XCircle}
                  subtitle="Reports that were rejected"
                />
              </>
            )}
          </div>
        )}

        {/* Report Type Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Reports by Type</h2>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries({
                  ASR: stats?.byType?.asr || 0,
                  OR: stats?.byType?.or || 0,
                  RIR: stats?.byType?.rir || 0,
                  NCR: stats?.byType?.ncr || 0,
                  CDF: stats?.byType?.cdf || 0,
                  CHR: stats?.byType?.chr || 0,
                }).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{type}</span>
                    <span className="text-sm font-medium font-mono">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Status Distribution</h2>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries({
                  Submitted: stats?.byStatus?.submitted || 0,
                  'In Review': stats?.byStatus?.in_review || 0,
                  Closed: stats?.byStatus?.closed || 0,
                  Rejected: stats?.byStatus?.rejected || 0,
                }).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{status}</span>
                    <span className="text-sm font-medium font-mono">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
