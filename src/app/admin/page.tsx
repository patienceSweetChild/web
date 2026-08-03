import { getMyProfile, getAllProfiles, getAllBoardPermissions, getAllUserBoardPermissions } from "@/features/users";
import { redirect } from "next/navigation";
import { AdminPanel } from "./admin-panel";

export default async function Page() {
  const profile = await getMyProfile();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    redirect('/boards/catalog?denied=1');
  }

  const [allUsers, boardPerms, userBoardOverrides] = await Promise.all([
    getAllProfiles(),
    getAllBoardPermissions(),
    profile.role === 'super_admin' ? getAllUserBoardPermissions() : Promise.resolve([]),
  ]);

  return (
    <AdminPanel
      myProfile={profile}
      allUsers={allUsers}
      boardPerms={boardPerms}
      userBoardOverrides={userBoardOverrides}
    />
  );
}
