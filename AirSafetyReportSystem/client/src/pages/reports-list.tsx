import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { Search, Calendar, Eye } from "lucide-react";
import { ReportTypeBadge } from "@/components/report-type-badge";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import type { Report, User } from "@shared/schema";

type ReportWithUser = Report & {
  submitter: User;
};

export default function ReportsList() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const { data: reports, isLoading } = useQuery<ReportWithUser[]>({
    queryKey: ["/api/reports", typeFilter, statusFilter],
  });

  const filteredReports = reports?.filter((report) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        report.id.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.flightNumber?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">All Reports</h1>
          <p className="text-muted-foreground">
            Browse and manage aviation safety reports
          </p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, description, or flight number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger data-testid="select-type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asr">Air Safety Report</SelectItem>
                <SelectItem value="or">Occurrence Report</SelectItem>
                <SelectItem value="rir">Ramp Incident</SelectItem>
                <SelectItem value="ncr">Nonconformity</SelectItem>
                <SelectItem value="cdf">Commander's Discretion</SelectItem>
                <SelectItem value="chr">Hazard Report</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Reports Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-4 w-24" />
              </Card>
            ))}
          </div>
        ) : filteredReports && filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredReports.map((report) => (
              <Card key={report.id} className="p-6 hover-elevate" data-testid={`card-report-${report.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-wrap gap-2">
                    <ReportTypeBadge type={report.reportType} short />
                    <StatusBadge status={report.status} />
                  </div>
                  {report.createdAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                    </div>
                  )}
                </div>
                
                <p className="text-xs font-mono text-muted-foreground mb-3" data-testid={`text-report-id-${report.id}`}>
                  ID: {report.id.slice(0, 8)}...
                </p>

                {report.flightNumber && (
                  <p className="text-sm font-medium mb-2">
                    Flight: <span className="font-mono">{report.flightNumber}</span>
                  </p>
                )}

                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {report.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {report.isAnonymous === 1 ? (
                      <span>Anonymous Report</span>
                    ) : (
                      <span>
                        By: {report.submitter?.firstName && report.submitter?.lastName
                          ? `${report.submitter.firstName} ${report.submitter.lastName}`
                          : report.submitter?.email || "Unknown"}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" asChild data-testid={`button-view-${report.id}`}>
                    <Link href={`/reports/${report.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No reports found</p>
            <Button asChild data-testid="button-create-first">
              <Link href="/reports/new/asr">Create Your First Report</Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
