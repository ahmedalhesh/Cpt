import {
  LayoutDashboard,
  FileText,
  Settings,
  Shield,
  LogOut,
  Users,
  Bell,
  User,
  BarChart3,
  Plus,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Fetch unread notifications count
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }
      
      return response.json();
    },
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch on mount
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch company settings
  const { data: companySettings } = useCompanySettings();

  const navigationItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: FileText,
    },
    {
      title: "Notifications",
      url: "/notifications",
      icon: Bell,
    },
    {
      title: "Profile",
      url: "/profile",
      icon: User,
    },
  ];


  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-3">
          <CompanyLogo size="md" />
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {companySettings?.companyName || "Report Sys"}
            </h2>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/ /g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.title === "Notifications" && unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-auto animate-pulse">
                          {unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {/* Create Report Section for Captains and First Officers */}
        {(user?.role === 'captain' || user?.role === 'first_officer') && (
          <SidebarGroup>
            <SidebarGroupLabel>Create Report</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/reports/new/asr'}>
                    <Link href="/reports/new/asr" data-testid="link-create-asr">
                      <Plus className="h-4 w-4" />
                      <span>New ASR Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/reports/new/ncr'}>
                    <Link href="/reports/new/ncr" data-testid="link-create-ncr">
                      <Plus className="h-4 w-4" />
                      <span>New NCR Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/reports/new/cdf'}>
                    <Link href="/reports/new/cdf" data-testid="link-create-cdf">
                      <Plus className="h-4 w-4" />
                      <span>New CDF Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/reports/new/chr'}>
                    <Link href="/reports/new/chr" data-testid="link-create-chr">
                      <Plus className="h-4 w-4" />
                      <span>New CHR Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/reports/new/or'}>
                    <Link href="/reports/new/or" data-testid="link-create-or">
                      <Plus className="h-4 w-4" />
                      <span>New OR Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/reports/new/rir'}>
                    <Link href="/reports/new/rir" data-testid="link-create-rir">
                      <Plus className="h-4 w-4" />
                      <span>New RIR Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user?.role === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/users'}>
                    <Link href="/users" data-testid="link-users">
                      <Users className="h-4 w-4" />
                      <span>Users Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/settings'}>
                    <Link href="/settings" data-testid="link-settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profileImageUrl || undefined} className="object-cover" />
              <AvatarFallback className="text-xs">
                {getInitials(user?.firstName, user?.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || "User"}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {user?.role?.replace('_', ' ') || "Captain"}
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
