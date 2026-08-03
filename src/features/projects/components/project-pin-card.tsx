"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectWithRelations } from "../types";
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  projectCalendarEnd,
  projectCalendarStart,
} from "../types";

function memberCounts(project: ProjectWithRelations) {
  const members = project.members ?? [];
  return {
    admin: members.filter((m) => m.role_on_project === "admin").length,
    tl: members.filter((m) => m.role_on_project === "team_leader").length,
    sales: members.filter((m) => m.role_on_project === "sales").length,
    total: members.length,
  };
}

export function ProjectPinCard({ project }: { project: ProjectWithRelations }) {
  const router = useRouter();
  const sc = PROJECT_STATUS_COLORS[project.status];
  const counts = memberCounts(project);
  const shortId = project.id.slice(0, 4).toUpperCase();
  const href = `/projects/${project.id}`;
  const start = projectCalendarStart(project);
  const end = projectCalendarEnd(project);
  const dateLabel = start === end ? start : `${start} → ${end}`;

  function open() {
    router.push(href);
  }

  return (
    <article
      className="board-card project-pin-card"
      tabIndex={0}
      role="button"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="card-top">
        <div className="card-title-wrap">
          <h2 className="card-title">{project.name}</h2>
        </div>
        <span
          className="list-status"
          style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
        >
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>

      <div className="tags">
        {project.client ? (
          <Link
            href={`/clients/${project.client.id}?tab=projects`}
            className="tag kit"
            onClick={(e) => e.stopPropagation()}
          >
            {project.client.name.toUpperCase()}
          </Link>
        ) : (
          <span className="tag neutral">NO CLIENT</span>
        )}
        <span className="tag neutral">{dateLabel}</span>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="btn-state expand"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          ⤢ Expand
        </button>
        <button
          type="button"
          className="btn-duplicate"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          View
        </button>
      </div>

      <div className="stats">
        <div className="stat user-metric-stat user-metric-stat--neutral" title="Admins">
          <span className="num">{counts.admin}</span>
          <span className="label">ADMIN</span>
        </div>
        <div className="stat user-metric-stat user-metric-stat--maybe" title="Team leaders">
          <span className="num">{counts.tl}</span>
          <span className="label">TL</span>
        </div>
        <div className="stat user-metric-stat user-metric-stat--yes" title="Sales">
          <span className="num">{counts.sales}</span>
          <span className="label">SALES</span>
        </div>
        <div className="stat user-metric-stat user-metric-stat--no" title="Total members">
          <span className="num">{counts.total}</span>
          <span className="label">TEAM</span>
        </div>
      </div>

      <div className="card-footer">
        <span className="star">★</span>
        <span className="footer-label">
          {counts.total} member{counts.total === 1 ? "" : "s"}
        </span>
        <span className="pin-id">{shortId}</span>
      </div>
    </article>
  );
}
