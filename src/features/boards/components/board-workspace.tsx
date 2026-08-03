"use client";

import { AppShell } from "@/features/shell/app-shell";
import { BoardFilterBar } from "@/features/boards/components/board-filter-bar";
import type { BoardWorkspaceController } from "@/features/boards/hooks/use-board-workspace";
import { PinDetailDrawer } from "@/features/pins/components/pin-detail-drawer";
import type { BoardId } from "@/features/pins/types";
import type { FilterRowConfig } from "@/features/boards/components/board-filter-bar";
import { useUser } from "@/features/users/user-provider";
import { useEffectiveBoardPermissions } from "@/features/boards/hooks/use-effective-board-permissions";

type BoardWorkspaceProps = {
  title: string;
  boardId: BoardId;
  workspace: BoardWorkspaceController;
  children: React.ReactNode;
  searchPlaceholder?: string;
  resultLabel?: string;
  resultCount?: number;
  intro?: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  filterRows?: FilterRowConfig[];
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  contentClassName?: string;
  branchFilter?: Set<string>;
  onBranchFilterChange?: (s: Set<string>) => void;
};

export function BoardWorkspace({
  title,
  boardId,
  workspace,
  children,
  searchPlaceholder,
  resultLabel,
  resultCount,
  intro,
  toolbarExtra,
  filterRows,
  primaryLabel,
  onPrimaryAction,
  contentClassName = "content",
  branchFilter,
  onBranchFilterChange,
}: BoardWorkspaceProps) {
  const { profile, unreadCount } = useUser();
  const perms = useEffectiveBoardPermissions(boardId);

  const canViewBoard = perms.can_view;
  const canCreatePin = perms.can_create && canViewBoard;
  const canEditPin = perms.can_edit && canViewBoard;

  const readOnly = workspace.detailMode === "edit" ? !canEditPin : !canCreatePin;

  const crumbs =
    boardId === "catalog"
      ? [{ label: "Boards" }, { label: title }]
      : [
          { label: "Boards", href: "/boards/catalog" },
          { label: title },
        ];

  if (!canViewBoard) {
    return (
      <AppShell
        title={title}
        crumbs={crumbs}
        boardId={boardId}
        profile={profile}
        unreadCount={unreadCount}
        canCreatePin={false}
      >
        <div className="content">
          <div className="empty-state">Access denied for this board.</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={title}
      crumbs={crumbs}
      boardId={boardId}
      onCreatePin={canCreatePin ? () => workspace.createPin() : undefined}
      primaryLabel={primaryLabel}
      onPrimaryAction={onPrimaryAction}
      profile={profile}
      unreadCount={unreadCount}
      canCreatePin={canCreatePin}
    >
      <BoardFilterBar
        boardId={boardId}
        query={workspace.query}
        onQueryChange={workspace.setQuery}
        filters={workspace.filters}
        onFiltersChange={workspace.setFilters}
        resultCount={resultCount ?? workspace.filtered.length}
        searchPlaceholder={searchPlaceholder}
        resultLabel={resultLabel}
        toolbarExtra={toolbarExtra}
        filterRows={filterRows}
        branchFilter={branchFilter}
        onBranchFilterChange={onBranchFilterChange}
      />
      {intro}
      <main className={contentClassName}>
        {workspace.ready ? children : <p className="loading-msg">Loading pins…</p>}
      </main>
      <PinDetailDrawer
        pin={workspace.activePin}
        mode={workspace.detailMode}
        boardId={boardId}
        open={workspace.drawerOpen}
        onClose={() => workspace.setDrawerOpen(false)}
        onSave={readOnly ? async () => {} : workspace.onSave}
        onDuplicate={canCreatePin ? workspace.onDuplicate : undefined}
        readOnly={readOnly}
      />
    </AppShell>
  );
}
