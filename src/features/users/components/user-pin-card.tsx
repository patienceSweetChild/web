"use client";

import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_LABELS, ROLE_RANK } from "@/features/users/types";

export type UserMetrics = {
  visibleProjects: number;
  approved: number;
  pending: number;
  rejected: number;
};

const METRIC_CELLS: {
  key: keyof UserMetrics;
  label: string;
  title: string;
  tone: "neutral" | "yes" | "maybe" | "no";
}[] = [
  { key: "visibleProjects", label: "VISIBLE", title: "Visible projects", tone: "neutral" },
  { key: "approved", label: "YES", title: "Yes — approved", tone: "yes" },
  { key: "pending", label: "MAYBE", title: "Maybe — pending", tone: "maybe" },
  { key: "rejected", label: "NO", title: "No — rejected", tone: "no" },
];

function StageDots({ active }: { active: number }) {
  return (
    <div className="stages">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`stage s${i}${i <= active ? "" : " off"}`}>
          {i}
        </span>
      ))}
    </div>
  );
}

/** Team pin card — same layout as parent-board PinCard, metrics for users. */
export function UserPinCard({
  user,
  metrics,
  reportCount = 0,
}: {
  user: Profile;
  metrics: UserMetrics;
  reportCount?: number;
}) {
  const router = useRouter();
  const role = user.role as UserRole;
  const name = user.full_name || user.email.split("@")[0];
  const shortId = user.id.slice(0, 4).toUpperCase();
  const stage = ROLE_RANK[role] ?? 1;
  const href = `/users/${user.id}`;

  function open() {
    router.push(href);
  }

  return (
    <article
      className="board-card user-pin-card"
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
          <h2 className="card-title">{name}</h2>
        </div>
        {(role === "admin" || role === "super_admin" || role === "team_leader") && (
          <span className="PM-badge">
            {role === "super_admin" ? "SA" : role === "admin" ? "AD" : "TL"}
          </span>
        )}
      </div>

      <div className="tags">
        <span className="tag kit">{ROLE_LABELS[role].toUpperCase()}</span>
        {user.department ? (
          <span className="tag neutral">{user.department.toUpperCase()}</span>
        ) : (
          <span className="tag neutral">TEAM</span>
        )}
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
        {METRIC_CELLS.map((cell) => (
          <div
            key={cell.key}
            className={`stat user-metric-stat user-metric-stat--${cell.tone}`}
            title={cell.title}
          >
            <span className="num">{metrics[cell.key]}</span>
            <span className="label">{cell.label}</span>
          </div>
        ))}
      </div>

      <div className="card-footer">
        <span className="star">★</span>
        <StageDots active={stage} />
        <span className="footer-label">
          {reportCount > 0
            ? `${reportCount} report${reportCount === 1 ? "" : "s"}`
            : ROLE_LABELS[role]}
        </span>
        <span className="pin-id">{shortId}</span>
      </div>
    </article>
  );
}
