import { getMyProfile, getAllProfiles } from "@/features/users";
import { listClients } from "@/features/clients";
import { listProjects } from "@/features/projects/queries";
import { redirect } from "next/navigation";
import { ProjectsPage } from "./projects-page";

export default async function Page() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const [projects, clients, allUsers] = await Promise.all([
    listProjects().catch(() => []),
    listClients().catch(() => []),
    getAllProfiles().catch(() => []),
  ]);

  return (
    <ProjectsPage
      myProfile={profile}
      projects={projects}
      clients={clients}
      allUsers={allUsers}
    />
  );
}
