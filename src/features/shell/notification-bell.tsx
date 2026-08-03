"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/features/notifications/types";
import { markAllRead, markOneRead } from "@/features/notifications/actions";
import type { UserRole } from "@/features/users/types";
import { useUser } from "@/features/users/user-provider";

const NOTIF_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "team_leader",
  "sales",
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notifIcon(type: string) {
  if (type === "client_created") return "🧑‍💼";
  if (type === "client_assigned") return "→";
  if (type === "project_created") return "▣";
  if (type === "project_member_added") return "＋";
  return "🔔";
}

function notifHref(n: AppNotification): string | null {
  const payload = n.payload as Record<string, string> | null;
  if (payload?.project_id) return `/projects/${payload.project_id}`;
  if (payload?.client_id) return `/clients/${payload.client_id}`;
  return null;
}

/** Reddit-style bell + dropdown for recent notifications. */
export function NotificationBell() {
  const { profile, unreadCount, refreshUnread } = useUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const role = profile?.role as UserRole | undefined;
  const canUse = Boolean(profile && role && NOTIF_ROLES.includes(role));

  const loadItems = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setItems((data ?? []) as AppNotification[]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open, loadItems]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canUse) return null;

  function handleMarkAll() {
    if (!profile) return;
    startTransition(async () => {
      await markAllRead(profile.id);
      refreshUnread();
      await loadItems();
    });
  }

  function handleMarkOne(id: string) {
    startTransition(async () => {
      await markOneRead(id);
      refreshUnread();
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    });
  }

  return (
    <div className={`notif-bell${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="notif-bell-btn"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
      >
        <span className="notif-bell-ico" aria-hidden>
          🔔
        </span>
        {unreadCount > 0 ? (
          <span className="notif-bell-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-bell-panel" role="dialog" aria-label="Notifications">
          <div className="notif-bell-head">
            <span className="notif-bell-title">Notifications</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="notif-bell-mark-all"
                onClick={handleMarkAll}
                disabled={pending}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="notif-bell-list">
            {loading && items.length === 0 ? (
              <div className="notif-bell-empty">Loading…</div>
            ) : items.length === 0 ? (
              <div className="notif-bell-empty">No notifications yet</div>
            ) : (
              items.map((n) => {
                const href = notifHref(n);
                const isUnread = !n.read_at;
                const inner = (
                  <>
                    <span className="notif-bell-item-ico" aria-hidden>
                      {notifIcon(n.type)}
                    </span>
                    <span className="notif-bell-item-body">
                      <span className="notif-bell-item-title">{n.title}</span>
                      {n.body ? (
                        <span className="notif-bell-item-desc">{n.body}</span>
                      ) : null}
                      <span className="notif-bell-item-time">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    {isUnread ? (
                      <span className="notif-bell-dot" aria-hidden />
                    ) : null}
                  </>
                );

                return (
                  <div
                    key={n.id}
                    className={`notif-bell-item${isUnread ? " unread" : ""}`}
                  >
                    {href ? (
                      <Link
                        href={href}
                        className="notif-bell-item-main"
                        onClick={() => {
                          if (isUnread) handleMarkOne(n.id);
                          setOpen(false);
                        }}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="notif-bell-item-main"
                        onClick={() => {
                          if (isUnread) handleMarkOne(n.id);
                        }}
                      >
                        {inner}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="notif-bell-foot">
            <Link
              href="/notifications"
              className="notif-bell-view-all"
              onClick={() => setOpen(false)}
            >
              View all pending
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
