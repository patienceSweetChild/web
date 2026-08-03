import {
  getMyProfile,
  getProfileById,
  getDirectReports,
  getBoardPermissionsForRole,
  getUserBoardPermissions,
} from "@/features/users";
import type { UserBoardPerm, UserRole } from "@/features/users";
import { listClients, getUnassignedClients } from "@/features/clients";
import { redirect } from "next/navigation";
import { UserDetailPage } from "./user-detail-page";

type RoleBoardPerm = {
  board_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type OverrideRow = {
  board_id: string;
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [myProfile, targetProfile] = await Promise.all([
    getMyProfile(),
    getProfileById(id),
  ]);

  if (!myProfile || myProfile.role === "sales" || myProfile.role === "viewer") {
    redirect("/boards/catalog?denied=1");
  }
  if (!targetProfile) redirect("/users");

  const canAssign =
    myProfile.role === "super_admin" ||
    myProfile.role === "admin" ||
    myProfile.role === "team_leader";

  const [reports, clients, unassignedClients] = await Promise.all([
    getDirectReports(id),
    listClients({ assignedTo: id }),
    canAssign ? getUnassignedClients() : Promise.resolve([]),
  ]);

  const userBoardPerms =
    myProfile.role === "super_admin"
      ? await (async () => {
          const rolePerms = (await getBoardPermissionsForRole(
            targetProfile.role as UserRole
          )) as RoleBoardPerm[];
          const overrides = (await getUserBoardPermissions(
            targetProfile.id
          )) as OverrideRow[];
          const byBoard = new Map(overrides.map((o) => [o.board_id, o] as const));

          return rolePerms.map((rp) => {
            const o = byBoard.get(rp.board_id);
            return {
              board_id: rp.board_id,
              can_view: o?.can_view ?? rp.can_view,
              can_create: o?.can_create ?? rp.can_create,
              can_edit: o?.can_edit ?? rp.can_edit,
              can_delete: o?.can_delete ?? rp.can_delete,
            } satisfies UserBoardPerm;
          });
        })()
      : undefined;

  return (
    <UserDetailPage
      myProfile={myProfile}
      targetProfile={targetProfile}
      reports={reports}
      clients={clients}
      unassignedClients={unassignedClients}
      userBoardPerms={userBoardPerms}
    />
  );
}
