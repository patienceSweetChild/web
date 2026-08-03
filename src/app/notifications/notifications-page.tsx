"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile } from "@/features/users/types";
import type { AppNotification } from "@/features/notifications/types";
import { markAllRead, markOneRead } from "@/features/notifications/actions";
import { useUser } from "@/features/users/user-provider";
import { WorkspaceShell } from "@/features/shell";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsPage({
  myProfile,
  notifications,
}: {
  myProfile: Profile;
  notifications: AppNotification[];
}) {
  const router = useRouter();
  const { refreshUnread } = useUser();
  const [pending, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.read_at);

  function handleMarkAll() {
    startTransition(async () => {
      await markAllRead(myProfile.id);
      refreshUnread();
      router.refresh();
    });
  }

  function handleMarkOne(id: string) {
    startTransition(async () => {
      await markOneRead(id);
      refreshUnread();
      router.refresh();
    });
  }

  return (
    <WorkspaceShell
      title="Pending"
      crumbs={[
        { label: "Boards", href: "/boards/catalog" },
        { label: "Pending" },
      ]}
      projectType="Pending"
      profile={myProfile}
      topExtra={
        <>
          {unread.length > 0 && (
            <button className="btn" onClick={handleMarkAll} disabled={pending}>
              Mark all read
            </button>
          )}
          <span className="user-chip">{unread.length} unread</span>
        </>
      }
    >
      <div className="content">
        {notifications.length === 0 ? (
          <div className="empty-state">No notifications yet.</div>
        ) : (
          <div className="notif-list">
            {notifications.map((n) => {
              const isUnread = !n.read_at;
              const payload = n.payload as Record<string, string> | null;
              return (
                <div key={n.id} className={`notif-item${isUnread ? " unread" : ""}`}>
                  <div className="notif-icon">
                    {n.type === "client_created"
                      ? "🧑‍💼"
                      : n.type === "client_assigned"
                        ? "→"
                        : n.type === "project_created"
                          ? "▣"
                          : n.type === "project_member_added"
                            ? "＋"
                            : "🔔"}
                  </div>
                  <div className="notif-body">
                    <div className="notif-title">{n.title}</div>
                    {n.body && <div className="notif-desc">{n.body}</div>}
                    {payload?.project_id && (
                      <Link href={`/projects/${payload.project_id}`} className="notif-link">
                        View project →
                      </Link>
                    )}
                    {!payload?.project_id && payload?.client_id && (
                      <Link href={`/clients/${payload.client_id}`} className="notif-link">
                        View client →
                      </Link>
                    )}
                    <div className="notif-time">{timeAgo(n.created_at)}</div>
                  </div>
                  {isUnread && (
                    <button
                      className="btn btn-ghost notif-read-btn"
                      onClick={() => handleMarkOne(n.id)}
                      disabled={pending}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
