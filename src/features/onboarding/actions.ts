"use server";

import { createClient } from "@/lib/supabase/server";
import { createProject } from "@/features/projects/actions";
import { writeProjectLog } from "@/features/projects/write-project-log";
import type {
  OnboardingDiagnosis,
  OnboardingChatMessage,
  PipelineStatus,
  ShortlistItemSource,
} from "./types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Not authenticated");
  if (profile.role === "viewer") throw new Error("Not allowed");

  return { supabase, user, profile };
}

export async function updateCrmClientProfile(
  clientId: string,
  data: {
    name?: string;
    company?: string | null;
    contact_person?: string | null;
    phone?: string | null;
    email?: string | null;
    pipeline_status?: PipelineStatus;
    client_type?: string | null;
    branding?: string | null;
    industry?: string | null;
  }
) {
  const { supabase } = await requireUser();
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.company !== undefined) patch.company = data.company?.trim() || null;
  if (data.contact_person !== undefined)
    patch.contact_person = data.contact_person?.trim() || null;
  if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
  if (data.email !== undefined) patch.email = data.email?.trim() || null;
  if (data.pipeline_status !== undefined) patch.pipeline_status = data.pipeline_status;
  if (data.client_type !== undefined)
    patch.client_type = data.client_type?.trim() || null;
  if (data.branding !== undefined) patch.branding = data.branding?.trim() || null;
  if (data.industry !== undefined) patch.industry = data.industry?.trim() || null;

  const { error } = await supabase.from("crm_clients").update(patch).eq("id", clientId);
  if (error) throw new Error(error.message);
}

export async function ensureShortlist(clientId: string) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("client_pin_shortlists")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("client_pin_shortlists")
    .insert({ client_id: clientId, created_by: user.id, diagnosis: {} })
    .select()
    .single();

  if (error) {
    // Race: another request created it
    const { data: again } = await supabase
      .from("client_pin_shortlists")
      .select("*")
      .eq("client_id", clientId)
      .single();
    if (again) return again;
    throw new Error(error.message);
  }
  return data;
}

export async function saveShortlistDiagnosis(
  clientId: string,
  diagnosis: OnboardingDiagnosis
) {
  const shortlist = await ensureShortlist(clientId);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("client_pin_shortlists")
    .update({ diagnosis })
    .eq("id", shortlist.id);
  if (error) throw new Error(error.message);
}

export async function addPinsToShortlist(
  clientId: string,
  pinIds: string[],
  source: ShortlistItemSource = "manual"
) {
  if (!pinIds.length) return { added: 0 };
  const shortlist = await ensureShortlist(clientId);
  const { supabase, user } = await requireUser();

  const rows = pinIds.map((pin_id) => ({
    shortlist_id: shortlist.id,
    pin_id,
    source,
    added_by: user.id,
  }));

  const { error, data } = await supabase
    .from("client_pin_shortlist_items")
    .upsert(rows, { onConflict: "shortlist_id,pin_id", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(error.message);
  return { added: data?.length ?? 0, shortlistId: shortlist.id as string };
}

export async function removePinsFromShortlist(clientId: string, pinIds: string[]) {
  if (!pinIds.length) return;
  const shortlist = await ensureShortlist(clientId);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("client_pin_shortlist_items")
    .delete()
    .eq("shortlist_id", shortlist.id)
    .in("pin_id", pinIds);
  if (error) throw new Error(error.message);
}

export async function clearShortlist(clientId: string) {
  const shortlist = await ensureShortlist(clientId);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("client_pin_shortlist_items")
    .delete()
    .eq("shortlist_id", shortlist.id);
  if (error) throw new Error(error.message);
}

export async function checkoutOnboardingShortlist(clientId: string, clientName: string) {
  const { supabase, user } = await requireUser();
  const shortlist = await ensureShortlist(clientId);

  const { data: items, error: itemsErr } = await supabase
    .from("client_pin_shortlist_items")
    .select("pin_id")
    .eq("shortlist_id", shortlist.id);

  if (itemsErr) throw new Error(itemsErr.message);
  const pinIds = (items ?? []).map((i) => i.pin_id as string);
  if (!pinIds.length) throw new Error("Add at least one pin before checkout");

  const project = await createProject({
    name: `${clientName.trim() || "Client"} — Onboarding`,
    clientId,
    status: "unassigned",
  });

  const rows = pinIds.map((pin_id, index) => ({
    project_id: project.id,
    pin_id,
    sort_order: index,
    added_by: user.id,
  }));

  const { error } = await supabase.from("project_items").insert(rows);
  if (error) throw new Error(error.message);

  await writeProjectLog(supabase, {
    projectId: project.id as string,
    actorId: user.id,
    action: "pins_added",
    title: `Added ${pinIds.length} pin${pinIds.length === 1 ? "" : "s"} at checkout`,
    detail: pinIds.join(", "),
    payload: { pin_ids: pinIds, source: "onboarding_checkout" },
  });

  return { projectId: project.id as string };
}

export async function listProjectItems(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addProjectItems(projectId: string, pinIds: string[]) {
  if (!pinIds.length) return;
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("project_items")
    .select("pin_id, sort_order")
    .eq("project_id", projectId);
  const have = new Set((existing ?? []).map((r) => r.pin_id as string));
  const maxSort = (existing ?? []).reduce(
    (m, r) => Math.max(m, Number(r.sort_order) || 0),
    0
  );
  const toAdd = pinIds.filter((id) => !have.has(id));
  if (!toAdd.length) return;
  const rows = toAdd.map((pin_id, i) => ({
    project_id: projectId,
    pin_id,
    sort_order: maxSort + 1 + i,
    added_by: user.id,
  }));
  const { error } = await supabase.from("project_items").insert(rows);
  if (error) throw new Error(error.message);

  await writeProjectLog(supabase, {
    projectId,
    actorId: user.id,
    action: "pins_added",
    title: `Added ${toAdd.length} pin${toAdd.length === 1 ? "" : "s"}`,
    detail: toAdd.join(", "),
    payload: { pin_ids: toAdd },
  });
}

export async function removeProjectItems(projectId: string, pinIds: string[]) {
  if (!pinIds.length) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("project_items")
    .delete()
    .eq("project_id", projectId)
    .in("pin_id", pinIds);
  if (error) throw new Error(error.message);

  await writeProjectLog(supabase, {
    projectId,
    actorId: user.id,
    action: "pins_removed",
    title: `Removed ${pinIds.length} pin${pinIds.length === 1 ? "" : "s"}`,
    detail: pinIds.join(", "),
    payload: { pin_ids: pinIds },
  });
}

export async function ensureChatThread(clientId: string) {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("onboarding_chat_threads")
    .select("*")
    .eq("client_id", clientId)
    .eq("created_by", user.id)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("onboarding_chat_threads")
    .insert({ client_id: clientId, created_by: user.id })
    .select()
    .single();
  if (error) {
    const { data: again } = await supabase
      .from("onboarding_chat_threads")
      .select("*")
      .eq("client_id", clientId)
      .eq("created_by", user.id)
      .single();
    if (again) return again;
    throw new Error(error.message);
  }
  return data;
}

export async function appendChatMessage(
  threadId: string,
  role: "user" | "assistant",
  content: string
): Promise<OnboardingChatMessage> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("onboarding_chat_messages")
    .insert({ thread_id: threadId, role, content })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as OnboardingChatMessage;
}

export async function createCrmClientForOnboarding(data: {
  name: string;
  company?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  pipeline_status?: PipelineStatus;
  client_type?: string;
  branding?: string;
  industry?: string;
}) {
  const { supabase, user, profile } = await requireUser();

  const row: Record<string, unknown> = {
    name: data.name.trim(),
    company: data.company?.trim() || null,
    contact_person: data.contact_person?.trim() || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    pipeline_status: data.pipeline_status || "new",
    client_type: data.client_type?.trim() || null,
    branding: data.branding?.trim() || null,
    industry: data.industry?.trim() || null,
    created_by: user.id,
    status: "unassigned",
  };

  if (profile.role === "sales") {
    row.assigned_to = user.id;
    row.status = "active";
  } else if (profile.role === "team_leader") {
    row.team_leader_id = user.id;
  }

  const { data: client, error } = await supabase
    .from("crm_clients")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return client;
}

export async function fetchShortlistForClient(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { getShortlistForClient } = await import("./queries");
  return getShortlistForClient(clientId);
}

export async function fetchChatForClient(clientId: string) {
  const { user } = await requireUser();
  const { getChatMessagesForClient } = await import("./queries");
  return getChatMessagesForClient(clientId, user.id);
}

export async function fetchClientHistory(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { getClientAssignments, getClientById } = await import(
    "@/features/clients/queries"
  );
  const [assignments, client] = await Promise.all([
    getClientAssignments(clientId),
    getClientById(clientId),
  ]);
  return { assignments, client };
}
