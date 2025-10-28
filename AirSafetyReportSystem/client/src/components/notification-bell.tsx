import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { browserNotifications } from "@/lib/browserNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Bell, BellRing, Check, AlertCircle, Info, AlertTriangle, FileText, Calendar, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const previousNotificationsRef = useRef<Notification[]>([]); // Track previous notifications to detect new ones
  const permissionRequestedRef = useRef(false); // Track if we've already requested permission

  // Real notifications data - use same query key as notifications page for synchronization
  const { data: allNotifications = [], isLoading } = useQuery<Notification[]>({
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
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch on mount
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get unread count separately for better accuracy
  const { data: unreadCountData = 0 } = useQuery<number>({
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
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter and prepare notifications for display
  const unreadCount = typeof unreadCountData === 'number' ? unreadCountData : allNotifications.filter(n => !n.isRead).length;
  const recentNotifications = allNotifications.slice(0, 10); // Show first 10 notifications in dropdown

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
          
          // Invalidate queries to refresh the UI and sync with notifications page
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
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

  // Mark notification as read mutation
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
      // Invalidate all notification queries to sync with notifications page
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all notification queries to sync with notifications page
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      setNotificationToDelete(null);
      toast({
        title: "Notification deleted",
        description: "The notification has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete notification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete all notifications mutation
  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');
      
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete all notifications');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all notification queries to sync with notifications page
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      setShowDeleteAllDialog(false);
      toast({
        title: "All notifications deleted",
        description: "All notifications have been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete all notifications",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Request browser notification permission on mount
  useEffect(() => {
    if (!permissionRequestedRef.current && browserNotifications.isSupported) {
      permissionRequestedRef.current = true;
      
      // Request permission after a short delay to ensure user is authenticated
      const requestPermission = async () => {
        const token = localStorage.getItem('token');
        if (token) {
          const deviceInfo = browserNotifications.getDeviceInfo();
          const supportMessage = browserNotifications.getSupportMessage();
          
          // Show device-specific message if needed
          if (supportMessage) {
            console.info('🔔', supportMessage);
            toast({
              title: "إشعارات المتصفح",
              description: supportMessage,
              duration: 5000,
            });
          }
          
          const granted = await browserNotifications.requestPermission();
          if (granted) {
            console.log('🔔 Browser notifications permission granted');
            toast({
              title: "تم تفعيل إشعارات المتصفح",
              description: deviceInfo.isMobile 
                ? "ستتلقى إشعارات حتى عندما تكون التطبيق في الخلفية"
                : "ستتلقى إشعارات حتى عندما يكون التبويب غير نشط",
            });
          } else if (!supportMessage) {
            // Only show message if there's no specific support message
            toast({
              title: "إشعارات المتصفح",
              description: "لم يتم منح الإذن. يمكنك تفعيله لاحقاً من إعدادات المتصفح",
              variant: "default",
              duration: 3000,
            });
          }
        }
      };
      
      // Request permission after 2 seconds (once user is settled)
      const timer = setTimeout(requestPermission, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Monitor for new notifications and show browser notifications
  useEffect(() => {
    if (!browserNotifications.isAllowed() || !allNotifications.length) {
      previousNotificationsRef.current = allNotifications;
      return;
    }

    // Compare current notifications with previous to find new ones
    if (previousNotificationsRef.current.length > 0) {
      browserNotifications.showNotificationsForNewItems(
        allNotifications,
        previousNotificationsRef.current
      );
    }

    // Update previous notifications
    previousNotificationsRef.current = [...allNotifications];
  }, [allNotifications]);

  // Refetch notifications when dropdown opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      // Invalidate all notification queries to sync with notifications page
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    }
  }, [isOpen, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      browserNotifications.clearTrackedNotifications();
    };
  }, []);

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
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
            {allNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteAllDialog(true);
                }}
                disabled={deleteAllNotificationsMutation.isPending}
                className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete All
              </Button>
            )}
          </div>
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
                onSelect={(e) => {
                  e.preventDefault();
                }}
              >
                <div className={`flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer w-full ${
                  !notification.isRead ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
                >
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
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsReadMutation.mutate(notification.id);
                        }}
                        disabled={markAsReadMutation.isPending}
                        className="h-6 w-6 p-0"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotificationToDelete(notification.id);
                      }}
                      disabled={deleteNotificationMutation.isPending}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        
        {/* Delete notification confirmation dialog */}
        <AlertDialog open={!!notificationToDelete} onOpenChange={(open) => !open && setNotificationToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Notification</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this notification? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (notificationToDelete) {
                    deleteNotificationMutation.mutate(notificationToDelete);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete all notifications confirmation dialog */}
        <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete All Notifications</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all notifications? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  deleteAllNotificationsMutation.mutate();
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
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
