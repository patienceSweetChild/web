import { createClient } from "@/lib/supabase/server";
import type {
  ClientPinShortlist,
  ClientPinShortlistItem,
  OnboardingChatMessage,
  ProjectItem,
} from "./types";

export async function getShortlistForClient(
  clientId: string
): Promise<{
  shortlist: ClientPinShortlist | null;
  items: ClientPinShortlistItem[];
}> {
  const supabase = await createClient();
  const { data: shortlist } = await supabase
    .from("client_pin_shortlists")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!shortlist) return { shortlist: null, items: [] };

  const { data: items } = await supabase
    .from("client_pin_shortlist_items")
    .select("*")
    .eq("shortlist_id", shortlist.id)
    .order("created_at", { ascending: true });

  return {
    shortlist: shortlist as ClientPinShortlist,
    items: (items ?? []) as ClientPinShortlistItem[],
  };
}

export async function getChatMessagesForClient(
  clientId: string,
  userId: string
): Promise<{ threadId: string | null; messages: OnboardingChatMessage[] }> {
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("onboarding_chat_threads")
    .select("id")
    .eq("client_id", clientId)
    .eq("created_by", userId)
    .maybeSingle();

  if (!thread) return { threadId: null, messages: [] };

  const { data: messages } = await supabase
    .from("onboarding_chat_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });

  return {
    threadId: thread.id as string,
    messages: (messages ?? []) as OnboardingChatMessage[],
  };
}

export async function getProjectItems(
  projectId: string
): Promise<ProjectItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as ProjectItem[];
}
