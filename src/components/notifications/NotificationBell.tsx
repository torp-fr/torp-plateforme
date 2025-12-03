/**
 * NotificationBell Component
 * Cloche de notifications avec popover
 */

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import {
  notificationService,
  Notification,
} from '@/services/notifications/notification.service';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [notifs, count] = await Promise.all([
        notificationService.getAll(user.id, 15),
        notificationService.countUnread(user.id),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('[NotificationBell] Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadNotifications();

      // Rafraîchir toutes les 60 secondes
      const interval = setInterval(loadNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.id, loadNotifications]);

  // Recharger quand le popover s'ouvre
  useEffect(() => {
    if (open && user?.id) {
      loadNotifications();
    }
  }, [open, user?.id, loadNotifications]);

  async function handleMarkAllRead() {
    if (!user?.id) return;
    await notificationService.markAllAsRead(user.id);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleMarkAsRead(id: string) {
    await notificationService.markAsRead(id);
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await notificationService.delete(id);
    const wasUnread = notifications.find((n) => n.id === id && !n.read);
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function handleNotificationClick(notif: Notification) {
    handleMarkAsRead(notif.id);

    // Navigation selon le type
    if (notif.data) {
      const data = notif.data as Record<string, unknown>;
      switch (notif.type) {
        case 'analysis_complete':
          if (data.analysisId) {
            navigate(`/results?devisId=${data.analysisId}`);
            setOpen(false);
          }
          break;
        case 'comparison_complete':
          if (data.comparisonId) {
            navigate(`/compare?id=${data.comparisonId}`);
            setOpen(false);
          }
          break;
        default:
          break;
      }
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'analysis_complete':
        return '📊';
      case 'welcome':
        return '👋';
      case 'ticket_generated':
        return '🎫';
      case 'document_expiring':
        return '⚠️';
      case 'comparison_complete':
        return '⚖️';
      default:
        return '📬';
    }
  }

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Tout lire
            </Button>
          )}
        </div>

        <ScrollArea className="h-[320px]">
          {loading && notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-pulse">Chargement...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors relative group ${
                    !notif.read ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex items-start gap-3">
                    {!notif.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    )}
                    <div
                      className={`flex-1 min-w-0 ${notif.read ? 'ml-5' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base">
                          {getNotificationIcon(notif.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm truncate ${
                              !notif.read ? 'font-medium' : ''
                            }`}
                          >
                            {notif.title}
                          </p>
                          {notif.message && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {notif.message}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions au survol */}
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {!notif.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notif.id);
                        }}
                        title="Marquer comme lu"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(notif.id, e)}
                      title="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs w-full"
              onClick={() => {
                navigate('/notifications');
                setOpen(false);
              }}
            >
              Voir toutes les notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
