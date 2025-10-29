import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
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
import ReportDetail from "@/pages/report-detail";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import UsersManagement from "@/pages/users-management";
import Notifications from "@/pages/notifications";
import NotFound from "@/pages/not-found";
import { AppSidebar } from "@/components/app-sidebar";
import { AppFooter } from "@/components/app-footer";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <SidebarProvider>
      <div className="min-h-screen bg-background">
        <div className="flex">
          <AppSidebar />
          <main className="flex-1 lg:ml-64">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-foreground">Report System</h1>
                <div className="flex items-center space-x-4">
                  <ThemeToggle />
                </div>
              </div>
              
              <Router>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/dashboard" component={Dashboard} />
                  <Route path="/reports" component={ReportsList} />
                  <Route path="/reports/new/asr" component={NewReportASR} />
                  <Route path="/reports/new/or" component={NewReportOR} />
                  <Route path="/reports/new/rir" component={NewReportRIR} />
                  <Route path="/reports/new/ncr" component={NewReportNCR} />
                  <Route path="/reports/new/cdf" component={NewReportCDF} />
                  <Route path="/reports/new/chr" component={NewReportCHR} />
                  <Route path="/reports/:id" component={ReportDetail} />
                  <Route path="/profile" component={Profile} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/users" component={UsersManagement} />
                  <Route path="/notifications" component={Notifications} />
                  <Route component={NotFound} />
                </Switch>
              </Router>
            </div>
          </main>
        </div>
        <AppFooter />
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