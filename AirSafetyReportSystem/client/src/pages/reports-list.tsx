import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { canCreateReports } from "@/lib/roles";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Link } from "wouter";
import { Search, Calendar, Eye, FileText, Clock, CheckCircle2, AlertTriangle, Filter, User as UserIcon, CalendarDays, SortAsc, SortDesc, Plus, XCircle, Check, ChevronsUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportTypeBadge } from "@/components/report-type-badge";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Report, User } from "@shared/schema";

type ReportWithUser = Report & {
  submitter: User;
};

export default function ReportsList() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [submittedByFilter, setSubmittedByFilter] = useState<string>("all");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submittedByOpen, setSubmittedByOpen] = useState(false);

  // Report creation for Captains and First Officers only
  const canCreate = canCreateReports(user?.role);

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
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const url = new URL('/api/reports', window.location.origin);
      if (typeFilter !== 'all') url.searchParams.set('type', typeFilter);
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter);

      const res = await fetch(url.toString(), {
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch reports: ${res.status}`);
      }

      return await res.json();
    },
  });

  // Fetch users for the filter dropdown (admin only)
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === 'admin',
  });

  const filteredReports = reports?.filter((report) => {
    if (typeFilter !== "all" && report.reportType !== typeFilter) {
      return false;
    }
    if (statusFilter !== "all" && report.status !== statusFilter) {
      return false;
    }
    
    // Date filter
    if (dateFilter !== "all") {
      const reportDate = new Date(report.createdAt || 0);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case "today":
          if (daysDiff > 0) return false;
          break;
        case "week":
          if (daysDiff > 7) return false;
          break;
        case "month":
          if (daysDiff > 30) return false;
          break;
        case "year":
          if (daysDiff > 365) return false;
          break;
      }
    }
    
    // Specific date filter (from calendar)
    if (selectedDate) {
      const reportDate = new Date(report.createdAt || 0);
      const selectedDateOnly = new Date(selectedDate);
      selectedDateOnly.setHours(0, 0, 0, 0);
      const reportDateOnly = new Date(reportDate);
      reportDateOnly.setHours(0, 0, 0, 0);
      
      if (reportDateOnly.getTime() !== selectedDateOnly.getTime()) {
        return false;
      }
    }
    
    // Submitted By filter (admin only)
    if (user?.role === 'admin' && submittedByFilter !== 'all') {
      if (submittedByFilter === 'captain') {
        // Filter by role captain
        if (report.submitter?.role !== 'captain') return false;
      } else if (submittedByFilter === 'first_officer') {
        // Filter by role first_officer
        if (report.submitter?.role !== 'first_officer') return false;
      } else {
        // Filter by specific user ID
        if (report.submitter?.id !== submittedByFilter) return false;
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const shortId = report.id.slice(0, 5).toUpperCase();
      
      return (
        report.id.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.flightNumber?.toLowerCase().includes(query) ||
        `#${shortId}`.toLowerCase().includes(query) ||
        shortId.toLowerCase().includes(query)
      );
    }
    return true;
  })?.sort((a, b) => {
    if (sortBy === "oldest") {
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    } else if (sortBy === "type") {
      return a.reportType.localeCompare(b.reportType);
    } else if (sortBy === "status") {
      const statusOrder = { submitted: 1, in_review: 2, closed: 3, rejected: 4 };
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] || 5;
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 5;
      return aOrder - bOrder;
    } else {
      // Default: newest first (by creation date only)
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }
  });

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
                {user?.role === 'admin' ? 'All Reports' : 'My Reports'}
              </h1>
          <p className="text-muted-foreground">
                {user?.role === 'admin' 
                  ? 'Browse and manage all aviation safety reports' 
                  : 'View and manage your submitted reports'
                }
              </p>
            </div>
            
            {/* Create Report Dropdown */}
            {canCreateReports && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Create Report</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/reports/new/asr">New ASR Report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reports/new/ncr">New NCR Report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reports/new/cdf">New CDR Report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reports/new/chr">New CHR Report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reports/new/or">New OR Report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reports/new/rir">New RIR Report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reports/new/captain">New CR Report</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6">
          <div className="space-y-4">
            {/* Basic Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by #ID, description, or flight number..."
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
                  <SelectItem value="captain">CR</SelectItem>
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

            {/* Advanced Filters Toggle and Sort */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Filter className="h-4 w-4" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
              </Button>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground whitespace-nowrap">Sort by:</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">
                      <div className="flex items-center gap-2">
                        <SortDesc className="h-4 w-4" />
                        Newest First
                      </div>
                    </SelectItem>
                    <SelectItem value="oldest">
                      <div className="flex items-center gap-2">
                        <SortAsc className="h-4 w-4" />
                        Oldest First
                      </div>
                    </SelectItem>
                    <SelectItem value="type">Type A-Z</SelectItem>
                    <SelectItem value="status">Status Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvanced && (
              <div className={`grid grid-cols-1 gap-4 pt-4 border-t ${user?.role === 'admin' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Date Range
                  </label>
                  <Select value={dateFilter} onValueChange={(value) => {
                    setDateFilter(value);
                    if (value !== 'all') {
                      setSelectedDate(undefined);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last 30 Days</SelectItem>
                      <SelectItem value="year">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Select Specific Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          if (date) {
                            setDateFilter("all");
                          }
                        }}
                        initialFocus
                      />
                      {selectedDate && (
                        <div className="p-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedDate(undefined);
                            }}
                          >
                            Clear Date
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                
                {user?.role === 'admin' && (
                  <div>
                    <label className="text-sm font-medium mb-2 flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      Submitted By
                    </label>
                    <Popover open={submittedByOpen} onOpenChange={setSubmittedByOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={submittedByOpen}
                          className="w-full justify-between"
                        >
                          {submittedByFilter === "all"
                            ? "All Users"
                            : submittedByFilter === "captain"
                            ? "All Captains"
                            : submittedByFilter === "first_officer"
                            ? "All First Officers"
                            : users?.find((u) => u.id === submittedByFilter)
                            ? users.find((u) => u.id === submittedByFilter)?.firstName && users.find((u) => u.id === submittedByFilter)?.lastName
                              ? `${users.find((u) => u.id === submittedByFilter)?.firstName} ${users.find((u) => u.id === submittedByFilter)?.lastName} (${users.find((u) => u.id === submittedByFilter)?.role === 'captain' ? 'Captain' : 'First Officer'})`
                              : users.find((u) => u.id === submittedByFilter)?.email || 'Unknown'
                            : "Select user..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search users..." />
                          <CommandList>
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="all"
                                onSelect={() => {
                                  setSubmittedByFilter("all");
                                  setSubmittedByOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    submittedByFilter === "all" ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                All Users
                              </CommandItem>
                              <CommandItem
                                value="captain"
                                onSelect={() => {
                                  setSubmittedByFilter("captain");
                                  setSubmittedByOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    submittedByFilter === "captain" ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                All Captains
                              </CommandItem>
                              <CommandItem
                                value="first_officer"
                                onSelect={() => {
                                  setSubmittedByFilter("first_officer");
                                  setSubmittedByOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    submittedByFilter === "first_officer" ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                All First Officers
                              </CommandItem>
                            </CommandGroup>
                            {users && users.filter(u => u.role === 'captain').length > 0 && (
                              <CommandGroup heading="Captains">
                                {users
                                  .filter(u => u.role === 'captain')
                                  .map((captain) => (
                                    <CommandItem
                                      key={captain.id}
                                      value={`${captain.firstName || ''} ${captain.lastName || ''} ${captain.email || ''} captain`}
                                      onSelect={() => {
                                        setSubmittedByFilter(captain.id);
                                        setSubmittedByOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          submittedByFilter === captain.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {captain.firstName && captain.lastName 
                                        ? `${captain.firstName} ${captain.lastName} (Captain)`
                                        : captain.email || 'Unknown'}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            )}
                            {users && users.filter(u => u.role === 'first_officer').length > 0 && (
                              <CommandGroup heading="First Officers">
                                {users
                                  .filter(u => u.role === 'first_officer')
                                  .map((fo) => (
                                    <CommandItem
                                      key={fo.id}
                                      value={`${fo.firstName || ''} ${fo.lastName || ''} ${fo.email || ''} first officer`}
                                      onSelect={() => {
                                        setSubmittedByFilter(fo.id);
                                        setSubmittedByOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          submittedByFilter === fo.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {fo.firstName && fo.lastName 
                                        ? `${fo.firstName} ${fo.lastName} (First Officer)`
                                        : fo.email || 'Unknown'}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Report creation UI removed */}

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
          <div className="space-y-8">
            {/* Active Reports (Submitted & In Review) */}
            {filteredReports.filter(r => r.status === 'submitted' || r.status === 'in_review').length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  Active Reports
                  <span className="text-sm font-normal text-muted-foreground">
                    ({filteredReports.filter(r => r.status === 'submitted' || r.status === 'in_review').length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredReports
                    .filter(r => r.status === 'submitted' || r.status === 'in_review')
                    .map((report) => (
              <Card key={report.id} className="p-6 hover-elevate" data-testid={`card-report-${report.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-wrap gap-2">
                    <ReportTypeBadge type={report.reportType} short />
                    <StatusBadge status={report.status} />
                  </div>
                  {report.createdAt && (
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                      </div>
                      <div className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {format(new Date(report.createdAt), 'HH:mm')}
                      </div>
                    </div>
                  )}
                </div>
                
                <p className="text-xs font-mono text-muted-foreground mb-4" data-testid={`text-report-id-${report.id}`}>
                  #{report.id.slice(0, 5).toUpperCase()}
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
              </div>
            )}

            {/* Completed Reports (Closed & Rejected) */}
            {filteredReports.filter(r => r.status === 'closed' || r.status === 'rejected').length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  Completed Reports
                  <span className="text-sm font-normal text-muted-foreground">
                    ({filteredReports.filter(r => r.status === 'closed' || r.status === 'rejected').length})
                  </span>
                </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredReports
                    .filter(r => r.status === 'closed' || r.status === 'rejected')
                    .map((report) => (
              <Card key={report.id} className="p-6 hover-elevate" data-testid={`card-report-${report.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-wrap gap-2">
                    <ReportTypeBadge type={report.reportType} short />
                    <StatusBadge status={report.status} />
                  </div>
                  {report.createdAt && (
                            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                              </div>
                              <div className="flex items-center gap-1 font-mono">
                                <Clock className="h-3 w-3" />
                                {format(new Date(report.createdAt), 'HH:mm')}
                              </div>
                    </div>
                  )}
                </div>
                
                <p className="text-xs font-mono text-muted-foreground mb-3" data-testid={`text-report-id-${report.id}`}>
                          #{report.id.slice(0, 5).toUpperCase()}
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
              </div>
            )}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No reports found</p>
          </Card>
        )}
      </div>
    </div>
  );
}
