"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "./types";

interface UserContextValue {
  profile: Profile | null;
  unreadCount: number;
  loading: boolean;
  refreshProfile: () => void;
  refreshUnread: () => void;
}

const UserContext = createContext<UserContextValue>({
  profile: null,
  unreadCount: 0,
  loading: true,
  refreshProfile: () => {},
  refreshUnread: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(p as Profile | null);

    if (p) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      setUnreadCount(count ?? 0);
    } else {
      setUnreadCount(0);
    }

    setLoading(false);
  }, []);

  function refreshUnread() {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null)
        .then(({ count }) => setUnreadCount(count ?? 0));
    });
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      void load();
    });
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => subscription.unsubscribe();
  }, [load]);

  return (
    <UserContext.Provider
      value={{
        profile,
        unreadCount,
        loading,
        refreshProfile: load,
        refreshUnread,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
