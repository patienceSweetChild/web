"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useUser } from "@/features/users/user-provider";
import type { BoardId } from "@/features/pins/types";
import type { UserRole } from "@/features/users/types";

export type EffectiveBoardPermissions = {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

const cache = new Map<string, EffectiveBoardPermissions>();
const inflight = new Map<string, Promise<EffectiveBoardPermissions>>();

function roleFallback(role: UserRole | undefined, boardId: BoardId): EffectiveBoardPermissions {
  if (!role) {
    return { can_view: false, can_create: false, can_edit: false, can_delete: false };
  }

  // Seed-matching fallback for local/dev mode (no RPC).
  if (role === "super_admin" || role === "admin") {
    return { can_view: true, can_create: true, can_edit: true, can_delete: true };
  }

  if (role === "team_leader") {
    // Seed: team_leader can view all boards, edit clients only.
    return {
      can_view: true,
      can_create: boardId === "clients" ? false : false,
      can_edit: boardId === "clients",
      can_delete: false,
    };
  }

  if (role === "sales") {
    // Seed: view is allowed except problems; create/edit/delete disabled.
    return {
      can_view: boardId !== "problems",
      can_create: false,
      can_edit: false,
      can_delete: false,
    };
  }

  // viewer
  return {
    can_view: boardId !== "problems",
    can_create: false,
    can_edit: false,
    can_delete: false,
  };
}

export function useEffectiveBoardPermissions(boardId: BoardId) {
  const { profile } = useUser();
  const [perms, setPerms] = useState<EffectiveBoardPermissions>(() =>
    roleFallback(profile?.role, boardId)
  );

  useEffect(() => {
    const userId = profile?.id;
    const defer = (fn: () => void) => {
      void Promise.resolve().then(fn);
    };
    if (!userId) {
      const fb = roleFallback(profile?.role, boardId);
      defer(() => setPerms(fb));
      return;
    }

    if (!isSupabaseConfigured()) {
      const fb = roleFallback(profile?.role, boardId);
      defer(() => setPerms(fb));
      return;
    }

    const key = `${userId}:${boardId}`;
    const cached = cache.get(key);
    if (cached) {
      defer(() => setPerms(cached));
      return;
    }

    const existing = inflight.get(key);
    if (existing) {
      existing
        .then((p) => {
          cache.set(key, p);
          setPerms(p);
        })
        .catch(() => {
          // Fall back to role-based UI gating if RPC fails.
          const fb = roleFallback(profile.role, boardId);
          cache.set(key, fb);
          setPerms(fb);
        });
      return;
    }

    const promise = (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_my_effective_board_permissions", {
        p_board_id: boardId,
      });

      if (error) throw error;

      const row =
        Array.isArray(data) ? data[0] : (data as Partial<EffectiveBoardPermissions> | null);
      const next: EffectiveBoardPermissions = {
        can_view: Boolean(row?.can_view),
        can_create: Boolean(row?.can_create),
        can_edit: Boolean(row?.can_edit),
        can_delete: Boolean(row?.can_delete),
      };
      return next;
    })();

    inflight.set(key, promise);
    promise
      .then((p) => {
        cache.set(key, p);
        setPerms(p);
      })
      .catch(() => {
        const fb = roleFallback(profile.role, boardId);
        cache.set(key, fb);
        setPerms(fb);
      })
      .finally(() => {
        inflight.delete(key);
      });
  }, [boardId, profile]);

  return perms;
}

