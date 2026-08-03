"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserBoardPermission } from "@/features/users/actions";

const BOARDS = [
  { id: "catalog", label: "Board Parent (Catalog)" },
  { id: "formats", label: "Board Child (Formats)" },
  { id: "clients", label: "Client Board" },
  { id: "sell-channels", label: "Sell Channels" },
  { id: "creative-packs", label: "Creative Packs" },
  { id: "problems", label: "Problems" },
] as const;

export type UserBoardPerm = {
  board_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type UserBoardAccessTableProps = {
  userId: string;
  initialPerms: UserBoardPerm[];
};

export function UserBoardAccessTable({
  userId,
  initialPerms,
}: UserBoardAccessTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [perms, setPerms] = useState<UserBoardPerm[]>(initialPerms);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setPerms(initialPerms);
    });
  }, [userId, initialPerms]);

  return (
    <div>
      <p style={{ color: "var(--jira-muted)", marginBottom: 16, fontSize: 13 }}>
        Super Admin: override this user’s board access independently of their role.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table className="sell-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th>Board</th>
              <th style={{ textAlign: "center" }}>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {BOARDS.map((board) => {
              const p = perms.find((x) => x.board_id === board.id);
              const activeField = (field: keyof UserBoardPerm) => p?.[field] ?? false;
              return (
                <tr key={board.id}>
                  <td style={{ fontWeight: 600 }}>{board.label}</td>
                  <td style={{ textAlign: "center" }}>
                    <div className="perm-toggles">
                      {(
                        ["can_view", "can_create", "can_edit", "can_delete"] as const
                      ).map((field) => {
                        const label = field.replace("can_", "")[0].toUpperCase();
                        const active = activeField(field);
                        return (
                          <button
                            key={field}
                            title={field.replace("can_", "")}
                            disabled={pending}
                            onClick={() => {
                              const nextVal = !active;
                              setPerms((prev) => {
                                const existing = prev.find((row) => row.board_id === board.id);
                                if (existing) {
                                  return prev.map((row) =>
                                    row.board_id === board.id
                                      ? { ...row, [field]: nextVal }
                                      : row
                                  );
                                }
                                return [
                                  ...prev,
                                  {
                                    board_id: board.id,
                                    can_view: field === "can_view" ? nextVal : false,
                                    can_create: field === "can_create" ? nextVal : false,
                                    can_edit: field === "can_edit" ? nextVal : false,
                                    can_delete: field === "can_delete" ? nextVal : false,
                                  },
                                ];
                              });
                              startTransition(async () => {
                                await updateUserBoardPermission(
                                  userId,
                                  board.id,
                                  field,
                                  nextVal
                                );
                                router.refresh();
                              });
                            }}
                            className={`perm-toggle-btn${active ? " active" : ""}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: "var(--jira-muted)" }}>
        V = View · C = Create · E = Edit · D = Delete
      </p>
    </div>
  );
}

export { BOARDS as ACCESS_BOARDS };
