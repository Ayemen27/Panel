import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@shared/schema';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAsResolved: (id: string) => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();

  const refreshNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.acknowledged).length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/acknowledge`, {
        method: 'PATCH',
        credentials: 'include'
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, acknowledged: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAsResolved = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/resolve`, {
        method: 'PATCH',
        credentials: 'include'
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, resolved: true } : n)
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as resolved:', error);
    }
  };

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'NOTIFICATION_CREATED':
        const newNotification = lastMessage.data as Notification;
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Show toast notification
        toast({
          title: newNotification.title,
          description: newNotification.message,
          variant: newNotification.type === 'error' ? 'destructive' : 'default',
        });
        break;

      case 'APPLICATION_STATUS_CHANGED':
      case 'APPLICATION_CREATED':
      case 'APPLICATION_UPDATED':
      case 'APPLICATION_DELETED':
        // Refresh notifications when applications change
        refreshNotifications();
        break;
    }
  }, [lastMessage, toast]);

  // Initial load
  useEffect(() => {
    refreshNotifications();
  }, []);

  // حفظ الإشعارات في localStorage مع معالجة الأخطاء
  useEffect(() => {
    try {
      // احتفظ بآخر 50 إشعار فقط لتوفير المساحة
      const notificationsToSave = notifications.slice(0, 50);
      localStorage.setItem('notifications', JSON.stringify(notificationsToSave));
    } catch (error) {
      console.warn('Failed to save notifications to localStorage:', error);

      // في حالة امتلاء localStorage، احذف البيانات القديمة
      try {
        localStorage.removeItem('notifications');
        const essentialNotifications = notifications.slice(0, 20);
        localStorage.setItem('notifications', JSON.stringify(essentialNotifications));
      } catch (fallbackError) {
        console.error('Failed to save even essential notifications:', fallbackError);
      }
    }
  }, [notifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAsResolved,
    refreshNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}