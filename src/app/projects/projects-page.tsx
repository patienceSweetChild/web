"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_COLORS, ROLE_LABELS } from "@/features/users/types";
import type { CrmClientWithProfiles } from "@/features/clients/types";
import { createProject } from "@/features/projects/actions";
import { filterProjectsByPeriod } from "@/features/projects/lib/period-filter";
import { ProjectDayCalendar } from "@/features/projects/components/project-day-calendar";
import { ProjectPinCard } from "@/features/projects/components/project-pin-card";
import {
  CreateProjectModal,
  type CreateProjectPayload,
} from "@/features/projects/components/create-project-modal";
import type { ProjectWithRelations } from "@/features/projects/types";
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  projectCalendarEnd,
  projectCalendarStart,
} from "@/features/projects/types";
import { MetricsPeriodPicker } from "@/features/users/components/metrics-period-picker";
import {
  currentMetricsPeriod,
  formatPeriodTitle,
  type MetricsPeriod,
} from "@/features/users/lib/metrics-period";
import { WorkspaceShell } from "@/features/shell";
import { SearchAutocomplete } from "@/shared/ui";

type ProjectsView = "list" | "pins" | "calendar";

export function ProjectsPage({
  myProfile,
  projects,
  clients,
  allUsers,
}: {
  myProfile: Profile;
  projects: ProjectWithRelations[];
  clients: CrmClientWithProfiles[];
  allUsers: Profile[];
}) {
  const router = useRouter();
  const [view, setView] = useState<ProjectsView>("list");
  const [period, setPeriod] = useState<MetricsPeriod>(() => currentMetricsPeriod());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();

  const role = myProfile.role as UserRole;
  const canCreate =
    role === "super_admin" ||
    role === "admin" ||
    role === "team_leader" ||
    role === "sales";

  const filtered = useMemo(() => {
    let list = projects;
    if (view === "pins") {
      list = filterProjectsByPeriod(list, period);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.client?.name.toLowerCase().includes(q) ?? false)
    );
  }, [projects, view, period, search]);

  function handleCreate(payload: CreateProjectPayload) {
    startTransition(async () => {
      await createProject({
        name: payload.name,
        clientId: payload.clientId,
        status: payload.status,
        startDate: payload.startDate,
        endDate: payload.endDate,
        notes: payload.notes,
        memberIds: payload.members,
      });
      setShowCreate(false);
      router.refresh();
    });
  }

  return (
    <WorkspaceShell
      title="Projects"
      crumbs={[
        { label: "Boards", href: "/boards/catalog" },
        { label: "Projects" },
      ]}
      projectType="Projects"
      profile={myProfile}
      topExtra={
        <>
          <div className="view-toggle" role="group" aria-label="Projects view">
            <button
              type="button"
              className={`view-toggle-btn${view === "list" ? " active" : ""}`}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`view-toggle-btn${view === "pins" ? " active" : ""}`}
              onClick={() => setView("pins")}
            >
              Pins
            </button>
            <button
              type="button"
              className={`view-toggle-btn${view === "calendar" ? " active" : ""}`}
              onClick={() => setView("calendar")}
            >
              Calendar
            </button>
          </div>
          {view === "pins" && (
            <MetricsPeriodPicker value={period} onChange={setPeriod} />
          )}
          {view !== "calendar" && (
            <SearchAutocomplete
              value={search}
              onChange={setSearch}
              suggestions={projects.flatMap((p) => {
                const items: { id: string; label: string; meta: string }[] = [
                  { id: p.id, label: p.name, meta: "Project" },
                ];
                if (p.client?.name) {
                  items.push({
                    id: `client:${p.id}:${p.client.id}`,
                    label: p.client.name,
                    meta: "Client",
                  });
                }
                return items;
              })}
              placeholder="Search projects…"
              recentKey="ac:projects"
            />
          )}
          <span className="user-chip">
            {view === "calendar"
              ? `${projects.length} project${projects.length !== 1 ? "s" : ""}`
              : `${filtered.length} project${filtered.length !== 1 ? "s" : ""}`}
          </span>
          {canCreate && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowCreate(true)}
            >
              + New Project
            </button>
          )}
        </>
      }
    >
      <div className="content">
        <CreateProjectModal
          open={showCreate}
          clients={clients}
          users={allUsers}
          actorRole={role}
          pending={pending}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />

        {view === "pins" && (
          <>
            <div className="team-pins-period-hint">
              Projects for <strong>{formatPeriodTitle(period)}</strong>
            </div>
            {filtered.length === 0 ? (
              <div className="empty-state">
                No projects in this period.
              </div>
            ) : (
              <div className="pin-grid">
                {filtered.map((p) => (
                  <ProjectPinCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </>
        )}

        {view === "calendar" && <ProjectDayCalendar projects={projects} />}

        {view === "list" && (
          <>
            {filtered.length === 0 ? (
              <div className="empty-state">
                {projects.length === 0
                  ? "No projects yet. Create one to get started."
                  : "No matching projects."}
              </div>
            ) : (
              <div className="project-list">
                {filtered.map((p) => {
                  const sc = PROJECT_STATUS_COLORS[p.status];
                  const start = projectCalendarStart(p);
                  const end = projectCalendarEnd(p);
                  const members = p.members ?? [];
                  return (
                    <div key={p.id} className="project-list-row">
                      <Link
                        href={`/projects/${p.id}`}
                        className="project-list-main"
                      >
                        <span className="project-list-name">{p.name}</span>
                        <span
                          className="list-status"
                          style={{
                            background: sc.bg,
                            color: sc.text,
                            borderColor: sc.border,
                          }}
                        >
                          {PROJECT_STATUS_LABELS[p.status]}
                        </span>
                      </Link>
                      <div className="project-list-meta">
                        {p.client ? (
                          <Link
                            href={`/clients/${p.client.id}?tab=projects`}
                            className="project-list-client"
                          >
                            {p.client.name}
                          </Link>
                        ) : (
                          <span className="project-list-client muted">—</span>
                        )}
                        <span className="project-list-dates">
                          {start === end ? start : `${start} → ${end}`}
                        </span>
                        <div className="project-list-members">
                          {members.slice(0, 5).map((m) => {
                            const u = m.user;
                            if (!u) return null;
                            const rc =
                              ROLE_COLORS[u.role as UserRole] ??
                              ROLE_COLORS.viewer;
                            return (
                              <span
                                key={m.id}
                                className="project-member-chip"
                                title={`${u.full_name || u.email} · ${ROLE_LABELS[m.role_on_project]}`}
                                style={{
                                  background: rc.bg,
                                  color: rc.text,
                                  borderColor: rc.border,
                                }}
                              >
                                {(u.full_name || u.email)[0].toUpperCase()}
                              </span>
                            );
                          })}
                          {members.length > 5 && (
                            <span className="project-member-more">
                              +{members.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}
