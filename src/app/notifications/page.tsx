import { getMyProfile } from "@/features/users";
import { listNotifications } from "@/features/notifications";
import { redirect } from "next/navigation";
import { NotificationsPage } from "./notifications-page";

export default async function Page() {
  const profile = await getMyProfile();
  if (!profile || !['super_admin', 'admin', 'team_leader', 'sales'].includes(profile.role)) {
    redirect('/boards/catalog?denied=1');
  }

  const notifications = await listNotifications(profile.id);

  return <NotificationsPage myProfile={profile} notifications={notifications} />;
}
