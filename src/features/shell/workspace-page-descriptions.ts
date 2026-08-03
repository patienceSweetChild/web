import type { UserRole } from "@/features/users/types";

/** Short page blurbs for workspace-rail destinations (list roots only). */
const WORKSPACE_DESCRIPTIONS: Record<string, string> = {
  "/onboarding": "Your client onboarding flow",
  "/clients": "Clients assigned to you",
  "/projects": "Projects assigned to you",
  "/users": "Your team",
  "/notifications": "Pending items for you",
  "/admin": "Admin tools assigned to you",
  "/profile": "Your profile",
};

/** Description for an exact workspace-rail list path; null on detail routes. */
export function getWorkspacePageDescription(
  pathname: string,
  _role?: UserRole | null
): string | null {
  const path = pathname.replace(/\/$/, "") || "/";
  return WORKSPACE_DESCRIPTIONS[path] ?? null;
}
