import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { CompanyLogo } from "@/components/company-logo";
import { DynamicTitle } from "@/components/dynamic-title";
import { DynamicAppIcons } from "@/components/dynamic-app-icons";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ReportsList from "@/pages/reports-list";
import ReportDetail from "@/pages/report-detail";
import NewReportASR from "@/pages/new-report-asr";
import NewReportCDF from "@/pages/new-report-cdf";
import NewReportCHR from "@/pages/new-report-chr";
import NewReportOR from "@/pages/new-report-or";
import NewReportRIR from "@/pages/new-report-rir";
import NewReportNCR from "@/pages/new-report-ncr";
import UsersManagement from "@/pages/users-management";
import Notifications from "@/pages/notifications";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import AppFooter from "@/components/app-footer";
import { ThemeToggle } from "@/components/theme-toggle";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Login} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/reports" component={ReportsList} />
          <Route path="/reports/:id" component={ReportDetail} />
          <Route path="/reports/new/asr" component={NewReportASR} />
          <Route path="/reports/new/cdf" component={NewReportCDF} />
          <Route path="/reports/new/chr" component={NewReportCHR} />
          <Route path="/reports/new/or" component={NewReportOR} />
          <Route path="/reports/new/rir" component={NewReportRIR} />
          <Route path="/reports/new/ncr" component={NewReportNCR} />
          <Route path="/users" component={UsersManagement} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Settings} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (!isLoading && isAuthenticated) {
    return (
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between p-4 border-b bg-background">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <NotificationBell />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
            <AppFooter />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return <Router />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DynamicTitle />
        <DynamicAppIcons />
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
