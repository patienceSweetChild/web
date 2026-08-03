import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectLogAction } from "./log-types";

/** Best-effort write; never fail the parent action if logging fails. */
export async function writeProjectLog(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    actorId: string;
    action: ProjectLogAction;
    title: string;
    detail?: string | null;
    payload?: Record<string, unknown> | null;
  }
) {
  try {
    const { error } = await supabase.from("project_logs").insert({
      project_id: input.projectId,
      actor_id: input.actorId,
      action: input.action,
      title: input.title,
      detail: input.detail ?? null,
      payload: input.payload ?? null,
    });
    if (error) {
      console.error("[project_logs]", error.message);
    }
  } catch (err) {
    console.error("[project_logs]", err);
  }
}
