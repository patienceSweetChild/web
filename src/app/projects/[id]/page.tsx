import { getMyProfile, getAllProfiles } from "@/features/users";
import { getProjectById, listProjectLogs } from "@/features/projects/queries";
import { getProjectItems } from "@/features/onboarding/queries";
import { redirect } from "next/navigation";
import { ProjectDetailPage } from "./project-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [myProfile, project] = await Promise.all([
    getMyProfile(),
    getProjectById(id),
  ]);

  if (!myProfile) redirect("/login");
  if (!project) redirect("/projects");

  const [allUsers, projectItems, logs] = await Promise.all([
    getAllProfiles().catch(() => []),
    getProjectItems(id).catch(() => []),
    listProjectLogs(id).catch(() => []),
  ]);

  return (
    <ProjectDetailPage
      myProfile={myProfile}
      project={project}
      allUsers={allUsers}
      projectItems={projectItems}
      logs={logs}
    />
  );
}
