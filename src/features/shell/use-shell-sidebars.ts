"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pins-shell-sidebars";

type ShellSidebarsState = {
  workspaceCollapsed: boolean;
  libraryCollapsed: boolean;
};

const DEFAULTS: ShellSidebarsState = {
  workspaceCollapsed: false,
  libraryCollapsed: false,
};

function readStored(): ShellSidebarsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ShellSidebarsState>;
    return {
      workspaceCollapsed: Boolean(parsed.workspaceCollapsed),
      libraryCollapsed: Boolean(parsed.libraryCollapsed),
    };
  } catch {
    return DEFAULTS;
  }
}

/** Persist independent collapse for workspace rail + library sidebar. */
export function useShellSidebars() {
  const [state, setState] = useState<ShellSidebarsState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state, hydrated]);

  const toggleWorkspace = useCallback(() => {
    setState((s) => ({ ...s, workspaceCollapsed: !s.workspaceCollapsed }));
  }, []);

  const toggleLibrary = useCallback(() => {
    setState((s) => ({ ...s, libraryCollapsed: !s.libraryCollapsed }));
  }, []);

  return {
    workspaceCollapsed: state.workspaceCollapsed,
    libraryCollapsed: state.libraryCollapsed,
    toggleWorkspace,
    toggleLibrary,
  };
}
