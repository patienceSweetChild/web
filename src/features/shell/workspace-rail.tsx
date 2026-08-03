"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";

type WorkspaceItem = {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
  visible: (role: UserRole | undefined) => boolean;
};

const WORKSPACE_ITEMS: WorkspaceItem[] = [
  {
    href: "/onboarding",
    label: "Onboarding",
    icon: "◇",
    match: (p) => p.startsWith("/onboarding"),
    visible: () => true,
  },
  {
    href: "/clients",
    label: "Clients",
    icon: "◉",
    match: (p) => p.startsWith("/clients"),
    visible: () => true,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: "▣",
    match: (p) => p.startsWith("/projects"),
    visible: () => true,
  },
  {
    href: "/users",
    label: "Team",
    icon: "🤝",
    match: (p) => p.startsWith("/users"),
    visible: (role) =>
      role === "super_admin" || role === "admin" || role === "team_leader",
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: "🔔",
    match: (p) => p.startsWith("/notifications"),
    visible: (role) =>
      role === "super_admin" ||
      role === "admin" ||
      role === "team_leader" ||
      role === "sales",
  },
  {
    href: "/admin",
    label: "Admin Panel",
    icon: "⚙",
    match: (p) => p.startsWith("/admin"),
    visible: (role) => role === "super_admin" || role === "admin",
  },
  {
    href: "/profile",
    label: "My Profile",
    icon: "◎",
    match: (p) => p.startsWith("/profile"),
    visible: () => true,
  },
];

/** Dark-rail workspace icons; hover expands labels in a flyout panel. */
export function WorkspaceRail({
  profile,
  unreadCount = 0,
}: {
  profile?: Profile | null;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const role = profile?.role as UserRole | undefined;

  if (!profile) return null;

  const items = WORKSPACE_ITEMS.filter((item) => item.visible(role));

  return (
    <nav className="rail-workspace" aria-label="Workspace">
      {items.map((item) => {
        const active = item.match(pathname);
        const showBadge = item.href === "/notifications" && unreadCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rail-nav-item${active ? " active" : ""}`}
            title={item.label}
          >
            <span className="rail-nav-ico" aria-hidden>
              {item.icon}
              {showBadge && (
                <span className="rail-nav-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
            <span className="rail-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
