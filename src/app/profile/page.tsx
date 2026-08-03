import { getMyProfile, getDirectReports, getDescendants } from "@/features/users";
import { listClients } from "@/features/clients";
import { redirect } from "next/navigation";
import { ProfilePage } from "./profile-page";

export default async function Page() {
  const profile = await getMyProfile();
  if (!profile) redirect('/login');

  const [reports, clients] = await Promise.all([
    getDirectReports(profile.id),
    listClients({ assignedTo: profile.id }),
  ]);

  return <ProfilePage myProfile={profile} reports={reports} ownClients={clients} />;
}
