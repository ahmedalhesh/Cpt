import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { DynamicTitle } from "@/components/dynamic-title";
import { DynamicAppIcons } from "@/components/dynamic-app-icons";
import { Router, Route, Switch } from "wouter";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ReportsList from "@/pages/reports-list";
import NewReportASR from "@/pages/new-report-asr";
import NewReportOR from "@/pages/new-report-or";
import NewReportRIR from "@/pages/new-report-rir";
import NewReportNCR from "@/pages/new-report-ncr";
import NewReportCDF from "@/pages/new-report-cdf";
import NewReportCHR from "@/pages/new-report-chr";
import NewReportCaptain from "@/pages/new-report-captain";
import ReportDetail from "@/pages/report-detail";
import MessagesInbox from "@/pages/messages-inbox";
import MessagesSent from "@/pages/messages-sent";
import MessageCompose from "@/pages/message-compose";
import MessageDetail from "@/pages/message-detail";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import UsersManagement from "@/pages/users-management";
import Notifications from "@/pages/notifications";
import NotFound from "@/pages/not-found";
import { AppSidebar } from "@/components/app-sidebar";
import { AppFooter } from "@/components/app-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import React from "react";

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
            <p className="text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function HeaderContent() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 sm:h-14 items-center justify-between px-3 sm:px-4 lg:px-6">
        <div className="flex items-center space-x-2 min-w-0">
          <SidebarTrigger className="mr-1 sm:mr-2 flex-shrink-0" />
          <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate">
            {/* Title removed as requested */}
          </h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show landing/login page
  if (!user) {
  return (
      <Router>
    <Switch>
      <Route path="/login" component={Login} />
        <Route path="/" component={Landing} />
          <Route component={NotFound} />
        </Switch>
      </Router>
    );
  }

  // If authenticated, show main app with sidebar
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen bg-background flex w-full">
        <AppSidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          <HeaderContent />
          <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
            <Router>
              <Switch>
          <Route path="/" component={Dashboard} />
                <Route path="/dashboard" component={Dashboard} />
          <Route path="/reports" component={ReportsList} />
          <Route path="/messages" component={MessagesInbox} />
          <Route path="/messages/sent" component={MessagesSent} />
          <Route path="/messages/compose" component={MessageCompose} />
          <Route path="/messages/:id" component={MessageDetail} />
          <Route path="/reports/new/asr" component={NewReportASR} />
          <Route path="/reports/new/or" component={NewReportOR} />
          <Route path="/reports/new/rir" component={NewReportRIR} />
          <Route path="/reports/new/ncr" component={NewReportNCR} />
          <Route path="/reports/new/cdf" component={NewReportCDF} />
          <Route path="/reports/new/chr" component={NewReportCHR} />
                <Route path="/reports/new/captain" component={NewReportCaptain} />
                <Route path="/reports/:id" component={ReportDetail} />
                <Route path="/profile" component={Profile} />
                <Route path="/settings" component={Settings} />
                <Route path="/users" component={UsersManagement} />
                <Route path="/notifications" component={Notifications} />
      <Route component={NotFound} />
    </Switch>
            </Router>
          </div>
          <AppFooter />
            </main>
        </div>
      </SidebarProvider>
    );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DynamicTitle />
        <DynamicAppIcons />
        <ErrorBoundary>
        <AppContent />
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
