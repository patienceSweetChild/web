import { getMyProfile, getAllProfiles } from "@/features/users";
import { getClientById, getClientAssignments } from "@/features/clients";
import { listProjectsForClient } from "@/features/projects/queries";
import { redirect } from "next/navigation";
import { ClientDetailPage } from "./client-detail-page";

const TABS = new Set(["overview", "projects", "history", "notes"]);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const initialTab = TABS.has(sp.tab ?? "")
    ? (sp.tab as "overview" | "projects" | "history" | "notes")
    : "overview";

  const [myProfile, client] = await Promise.all([
    getMyProfile(),
    getClientById(id),
  ]);

  if (!myProfile) redirect('/login');
  if (!client) redirect('/clients');

  const [assignments, allUsers, projects] = await Promise.all([
    getClientAssignments(id),
    getAllProfiles(),
    listProjectsForClient(id).catch(() => []),
  ]);

  return (
    <ClientDetailPage
      myProfile={myProfile}
      client={client}
      assignments={assignments}
      allUsers={allUsers}
      projects={projects}
      initialTab={initialTab}
    />
  );
}
