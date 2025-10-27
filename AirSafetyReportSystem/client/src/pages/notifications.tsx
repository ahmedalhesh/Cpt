import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  BellRing, 
  Check, 
  CheckCheck,
  AlertCircle,
  Info,
  AlertTriangle,
  FileText,
  User,
  Calendar,
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: string;
  userId: string;
  relatedReportId?: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  // Mock notifications data - in real app, this would come from API
  const mockNotifications: Notification[] = [
    {
      id: '1',
      title: 'New Report Submitted',
      message: 'A new Air Safety Report has been submitted by Captain Smith',
      type: 'info',
      isRead: false,
      createdAt: '2024-01-15T10:30:00Z',
      userId: user?.id || '',
    },
    {
      id: '2',
      title: 'Report Status Updated',
      message: 'Your ASR-2024-001 report status has been updated to "Under Review"',
      type: 'success',
      isRead: false,
      createdAt: '2024-01-15T09:15:00Z',
      userId: user?.id || '',
    },
    {
      id: '3',
      title: 'System Maintenance',
      message: 'Scheduled maintenance will occur tonight from 2:00 AM to 4:00 AM',
      type: 'warning',
      isRead: true,
      createdAt: '2024-01-14T16:45:00Z',
      userId: user?.id || '',
    },
    {
      id: '4',
      title: 'Password Reset Required',
      message: 'Your password will expire in 7 days. Please update it soon.',
      type: 'error',
      isRead: true,
      createdAt: '2024-01-14T08:00:00Z',
      userId: user?.id || '',
    },
  ];

  // Real API call
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      return response.json();
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: "Notification marked as read",
        description: "The notification has been marked as read",
      });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: "All notifications marked as read",
        description: "All notifications have been marked as read",
      });
    },
  });

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'read') return notification.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: string, title: string) => {
    // Special icons for comment-related notifications
    if (title.toLowerCase().includes('comment') || title.toLowerCase().includes('discussion')) {
      return <FileText className="h-5 w-5 text-purple-500" />;
    }
    
    switch (type) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <Check className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  // Smart routing function
  const handleNotificationClick = async (notification: Notification) => {
    console.log(`🔔 [CLIENT] Notification clicked: ${notification.title}`);
    console.log(`🔔 [CLIENT] Related report ID: ${notification.relatedReportId}`);
    
    // Mark notification as read if not already read
    if (!notification.isRead) {
      console.log(`📖 [CLIENT] Marking notification as read...`);
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
        }
      } catch (error) {
        console.error('❌ [CLIENT] Error marking notification as read:', error);
      }
    }

    // Smart routing based on notification type and content
    if (notification.relatedReportId) {
      console.log(`🎯 [CLIENT] Routing to report: ${notification.relatedReportId}`);
      
      // Determine the best route based on notification type
      let route = `/reports/${notification.relatedReportId}`;
      
      if (notification.title.toLowerCase().includes('comment') || 
          notification.title.toLowerCase().includes('discussion')) {
        // For comment notifications, add a hash to focus on comments section
        route += '#comments';
        console.log(`💬 [CLIENT] Comment notification - focusing on comments section`);
      } else if (notification.title.toLowerCase().includes('status') ||
                 notification.title.toLowerCase().includes('approved') ||
                 notification.title.toLowerCase().includes('rejected') ||
                 notification.title.toLowerCase().includes('review')) {
        // For status notifications, focus on status section
        route += '#status';
        console.log(`📊 [CLIENT] Status notification - focusing on status section`);
      }
      
      console.log(`🚀 [CLIENT] Navigating to: ${route}`);
      setLocation(route);
      
      toast({
        title: "Navigating to report",
        description: `Taking you to the relevant report...`,
      });
    } else {
      console.log(`⚠️ [CLIENT] No related report ID found, staying on notifications page`);
      toast({
        title: "Notification clicked",
        description: "This notification is not linked to a specific report.",
      });
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight mb-2">Notifications</h1>
              <p className="text-muted-foreground">
                Stay updated with system activities and important alerts
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {unreadCount} unread
                </Badge>
              )}
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark all as read
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </Button>
          <Button
            variant={filter === 'read' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('read')}
          >
            Read ({notifications.length - unreadCount})
          </Button>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications</h3>
              <p className="text-muted-foreground">
                {filter === 'all' 
                  ? "You don't have any notifications yet."
                  : `No ${filter} notifications found.`
                }
              </p>
            </Card>
                 ) : (
                   filteredNotifications.map((notification) => (
                     <Card 
                       key={notification.id} 
                       className={`p-6 transition-all hover:shadow-md cursor-pointer ${
                         !notification.isRead ? 'ring-2 ring-primary/20' : ''
                       } ${getNotificationColor(notification.type)}`}
                       onClick={() => handleNotificationClick(notification)}
                     >
                <div className="flex items-start gap-4">
                       <div className="flex-shrink-0 mt-1">
                         {getNotificationIcon(notification.type, notification.title)}
                       </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm mb-1">
                          {notification.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(notification.createdAt)}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            System
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!notification.isRead && (
                          <Badge variant="secondary" className="text-xs">
                            New
                          </Badge>
                        )}
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            disabled={markAsReadMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
