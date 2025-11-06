/**
 * Browser Notifications Service
 * Handles native browser notifications using the Notification API
 */

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead?: boolean;
  relatedReportId?: string;
}

class BrowserNotificationService {
  private permission: NotificationPermission = 'default';
  private _isSupported: boolean;
  private notificationIds: Set<string> = new Set(); // Track shown notifications to avoid duplicates
  private deviceInfo: {
    isIOS: boolean;
    isAndroid: boolean;
    isMobile: boolean;
    browser: string;
  };

  constructor() {
    this._isSupported = 'Notification' in window;
    
    // Detect device and browser information
    this.deviceInfo = this.detectDevice();
    
    if (this._isSupported) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Detect device type and browser
   */
  private detectDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // Check for iOS
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    
    // Check for Android
    const isAndroid = /Android/.test(userAgent);
    
    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    // Detect browser
    let browser = 'Unknown';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    }
    
    return {
      isIOS,
      isAndroid,
      isMobile,
      browser,
    };
  }

  /**
   * Get device information
   */
  getDeviceInfo() {
    return { ...this.deviceInfo };
  }

  /**
   * Check if notifications are supported on this device/browser
   */
  isFullySupported(): boolean {
    // Android: Fully supported
    if (this.deviceInfo.isAndroid) {
      return this._isSupported;
    }
    
    // iOS Safari: Limited support (only PWA, iOS 16.4+)
    if (this.deviceInfo.isIOS && this.deviceInfo.browser === 'Safari') {
      // Check if it's a PWA
      const isPWA = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                    (window.navigator as any).standalone === true;
      
      // iOS 16.4+ supports web push for PWAs
      // For now, we'll return false for Safari on iOS to show message
      return isPWA && this._isSupported;
    }
    
    // iOS Chrome: Supported
    if (this.deviceInfo.isIOS && this.deviceInfo.browser === 'Chrome') {
      return this._isSupported;
    }
    
    // Desktop and other browsers: Supported
    return this._isSupported;
  }

  /**
   * Get a user-friendly message about notification support
   */
  getSupportMessage(): string | null {
    if (this.isFullySupported() && this.isAllowed()) {
      return null; // Everything is working
    }

    if (this.deviceInfo.isIOS && this.deviceInfo.browser === 'Safari') {
      return 'إشعارات المتصفح محدودة على Safari في iOS. للحصول على أفضل تجربة، استخدم Chrome أو قم بتثبيت التطبيق كـ PWA';
    }

    if (!this.isSupported) {
      return 'المتصفح الحالي لا يدعم إشعارات المتصفح. يرجى استخدام Chrome أو Firefox أو Edge';
    }

    if (this.permission === 'denied') {
      return 'تم رفض الإذن لعرض الإشعارات. يرجى تفعيل الإشعارات من إعدادات المتصفح';
    }

    return null;
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return this._isSupported;
  }

  /**
   * Request permission from the user to show browser notifications
   */
  async requestPermission(): Promise<boolean> {
    if (!this._isSupported) {
      console.warn('🔔 Browser notifications are not supported in this browser');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      console.warn('🔔 Browser notification permission was denied');
      return false;
    }

    // On iOS Safari, show helpful message
    if (this.deviceInfo.isIOS && this.deviceInfo.browser === 'Safari') {
      console.info('🔔 iOS Safari has limited notification support. Consider using Chrome or installing as PWA');
      
      // Still try to request permission, it might work if it's a PWA
      try {
        const permission = await Notification.requestPermission();
        this.permission = permission;
        return permission === 'granted';
      } catch (error) {
        console.error('🔔 Error requesting notification permission:', error);
        return false;
      }
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('🔔 Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Check if notifications are supported and allowed
   */
  isAllowed(): boolean {
    return this._isSupported && this.permission === 'granted';
  }

  /**
   * Get the current permission status
   */
  getPermission(): NotificationPermission {
    return this.permission;
  }

  /**
   * Show a browser notification
   */
  showNotification(data: NotificationData): void {
    if (!this.isAllowed()) {
      return;
    }

    // Avoid showing duplicate notifications
    if (this.notificationIds.has(data.id)) {
      return;
    }

    try {
      const options: NotificationOptions = {
        body: data.message,
        icon: this.getNotificationIcon(data.type),
        badge: undefined, // Use browser default
        tag: data.id, // Tag to replace notifications with same ID
        requireInteraction: false,
        silent: false,
        data: {
          notificationId: data.id,
          relatedReportId: data.relatedReportId,
          type: data.type,
        },
      };

      const notification = new Notification(data.title, options);

      // Track this notification
      this.notificationIds.add(data.id);

      // Handle click on notification
      notification.onclick = (event) => {
        event.preventDefault();
        
        // Focus the window
        window.focus();

        // Navigate to the related report or notifications page
        if (data.relatedReportId) {
          window.location.href = `/reports/${data.relatedReportId}`;
        } else {
          window.location.href = '/notifications';
        }

        // Close the notification
        notification.close();
      };

      // Handle notification close
      notification.onclose = () => {
        // Remove from tracking after a delay to allow re-showing if needed
        setTimeout(() => {
          this.notificationIds.delete(data.id);
        }, 1000);
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

    } catch (error) {
      console.error('🔔 Error showing browser notification:', error);
    }
  }

  /**
   * Show notifications for new unread notifications
   */
  showNotificationsForNewItems(
    currentNotifications: NotificationData[],
    previousNotifications: NotificationData[]
  ): void {
    if (!this.isAllowed()) {
      return;
    }

    // Create a set of previous notification IDs for quick lookup
    const previousIds = new Set(previousNotifications.map(n => n.id));

    // Find new notifications (not in previous list and unread)
    const newNotifications = currentNotifications.filter(
      notification => !previousIds.has(notification.id) && notification.isRead !== true
    );

    // Show browser notification for each new unread notification
    newNotifications.forEach(notification => {
      this.showNotification({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        relatedReportId: notification.relatedReportId,
      });
    });
  }

  /**
   * Clear all tracked notification IDs (useful when logging out)
   */
  clearTrackedNotifications(): void {
    this.notificationIds.clear();
  }

  /**
   * Get icon URL based on notification type
   */
  private getNotificationIcon(type: string): string | undefined {
    // Use browser default icons for notifications
    // You can customize these icon paths based on your needs if you add icons later
    return undefined; // Browser will use default icon
  }
}

// Export singleton instance
export const browserNotifications = new BrowserNotificationService();

