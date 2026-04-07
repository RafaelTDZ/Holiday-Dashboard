import { useState, useEffect, useCallback } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link } from "wouter";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function getApiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api`;
}

interface Notif {
  id: number;
  message: string;
  read: boolean;
  vacationId: number | null;
  employeeId: number | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await fetch(`${getApiBase()}/notifications/read-all`, {
      method: "PUT",
      credentials: "include",
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: number) => {
    await fetch(`${getApiBase()}/notifications/${id}/read`, {
      method: "PUT",
      credentials: "include",
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          data-testid="notification-bell"
          title="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-lg" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              Marcar tudo como lido
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sem notificações.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`px-4 py-3 flex gap-3 items-start transition-colors hover:bg-muted/40 cursor-pointer ${
                  notif.read ? "opacity-60" : "bg-blue-50/60 dark:bg-blue-950/20"
                }`}
                onClick={() => {
                  if (!notif.read) markRead(notif.id);
                }}
              >
                <div className="mt-1 flex-shrink-0">
                  {!notif.read ? (
                    <span className="block w-2 h-2 rounded-full bg-blue-500" />
                  ) : (
                    <span className="block w-2 h-2 rounded-full bg-transparent border border-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{notif.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(parseISO(notif.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                  {notif.employeeId && (
                    <Link
                      href={`/employees/${notif.employeeId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!notif.read) markRead(notif.id);
                        setOpen(false);
                      }}
                      className="mt-1 text-[11px] text-primary hover:underline flex items-center gap-1 w-fit"
                    >
                      Ver funcionário <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20">
            <p className="text-[11px] text-muted-foreground text-center">
              {notifications.length} notificação{notifications.length !== 1 ? "ões" : ""} · Últimas 30
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
