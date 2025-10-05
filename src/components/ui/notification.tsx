'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function NotificationToast() {
  const { notifications, removeNotification } = useUIStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => {
        const Icon = iconMap[notification.type];
        
        return (
          <div
            key={notification.id}
            className={cn(
              'flex items-center space-x-3 rounded-lg border p-4 shadow-lg transition-all max-w-md',
              'bg-background text-foreground',
              {
                'border-green-200 bg-green-50': notification.type === 'success',
                'border-red-200 bg-red-50': notification.type === 'error',
                'border-yellow-200 bg-yellow-50': notification.type === 'warning',
                'border-blue-200 bg-blue-50': notification.type === 'info',
              }
            )}
          >
            <Icon
              className={cn('h-5 w-5 flex-shrink-0', {
                'text-green-600': notification.type === 'success',
                'text-red-600': notification.type === 'error',
                'text-yellow-600': notification.type === 'warning',
                'text-blue-600': notification.type === 'info',
              })}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{notification.title}</p>
              <p className="text-sm text-muted-foreground">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}