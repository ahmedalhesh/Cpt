import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Bell, BellRing, Check, AlertCircle, Info, AlertTriangle, FileText, Calendar } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: string;
  relatedReportId?: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Real notifications data
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/recent"],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      
      const response = await fetch('/api/notifications?isRead=false', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      return data.slice(0, 5); // Only show first 5 unread notifications
    },
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch on mount
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const recentNotifications = notifications.slice(0, 5);

  const getNotificationIcon = (type: string, title: string) => {
    // Special icons for comment-related notifications
    if (title.toLowerCase().includes('comment') || title.toLowerCase().includes('discussion')) {
      return <FileText className="h-4 w-4 text-purple-500" />;
    }
    
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Smart routing function for notification bell
  const handleNotificationClick = async (notification: Notification) => {
    console.log(`🔔 [BELL] Notification clicked: ${notification.title}`);
    console.log(`🔔 [BELL] Related report ID: ${notification.relatedReportId}`);
    
    // Mark notification as read if not already read
    if (!notification.isRead) {
      console.log(`📖 [BELL] Marking notification as read...`);
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await fetch(`/api/notifications/${notification.id}/read`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          // Invalidate queries to refresh the UI
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/recent"] });
        }
      } catch (error) {
        console.error('❌ [BELL] Error marking notification as read:', error);
      }
    }

    // Smart routing based on notification type and content
    if (notification.relatedReportId) {
      console.log(`🎯 [BELL] Routing to report: ${notification.relatedReportId}`);
      
      // Determine the best route based on notification type
      let route = `/reports/${notification.relatedReportId}`;
      
      if (notification.title.toLowerCase().includes('comment') || 
          notification.title.toLowerCase().includes('discussion')) {
        // For comment notifications, add a hash to focus on comments section
        route += '#comments';
        console.log(`💬 [BELL] Comment notification - focusing on comments section`);
      } else if (notification.title.toLowerCase().includes('status') ||
                 notification.title.toLowerCase().includes('approved') ||
                 notification.title.toLowerCase().includes('rejected') ||
                 notification.title.toLowerCase().includes('review')) {
        // For status notifications, focus on status section
        route += '#status';
        console.log(`📊 [BELL] Status notification - focusing on status section`);
      }
      
      console.log(`🚀 [BELL] Navigating to: ${route}`);
      setLocation(route);
      
      // Close the dropdown
      setIsOpen(false);
      
      toast({
        title: "Navigating to report",
        description: `Taking you to the relevant report...`,
      });
    } else {
      console.log(`⚠️ [BELL] No related report ID found, staying on current page`);
      toast({
        title: "Notification clicked",
        description: "This notification is not linked to a specific report.",
      });
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 animate-pulse" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>
        
        {isLoading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading...</p>
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="p-4 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {recentNotifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id} 
                className="p-0"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className={`flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer w-full ${
                  !notification.isRead ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}>
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type, notification.title)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">
                      {notification.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="flex items-center justify-center p-2">
            <Bell className="h-4 w-4 mr-2" />
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
