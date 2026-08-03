import type { Profile } from "@/features/users/types";

export type ProjectLogAction =
  | "project_created"
  | "status_changed"
  | "dates_updated"
  | "notes_updated"
  | "name_updated"
  | "member_added"
  | "member_removed"
  | "member_role_changed"
  | "pins_added"
  | "pins_removed";

export interface ProjectLog {
  id: string;
  project_id: string;
  actor_id: string | null;
  action: ProjectLogAction | string;
  title: string;
  detail: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  actor?: Pick<
    Profile,
    "id" | "full_name" | "email" | "role" | "avatar_url"
  > | null;
}
