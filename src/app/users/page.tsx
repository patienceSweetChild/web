import { getMyProfile, getAllProfiles } from "@/features/users";
import { listClients } from "@/features/clients";
import type { ClientMetricEvent } from "@/features/users/lib/metrics-period";
import { redirect } from "next/navigation";
import { UsersPage } from "./users-page";

export default async function Page() {
  const profile = await getMyProfile();
  if (!profile || profile.role === "sales" || profile.role === "viewer") {
    redirect("/boards/catalog?denied=1");
  }

  const [allUsers, clients] = await Promise.all([
    getAllProfiles(),
    listClients().catch(() => []),
  ]);

  const clientEvents: ClientMetricEvent[] = clients.map((c) => ({
    assigned_to: c.assigned_to,
    status: c.status,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  return (
    <UsersPage
      myProfile={profile}
      allUsers={allUsers}
      clientEvents={clientEvents}
    />
  );
}
