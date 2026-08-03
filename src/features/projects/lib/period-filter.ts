import type { MetricsPeriod } from "@/features/users/lib/metrics-period";
import { periodRange } from "@/features/users/lib/metrics-period";
import type { ProjectWithRelations } from "../types";
import { projectCalendarEnd, projectCalendarStart } from "../types";

function inRange(isoOrDate: string, start: Date, end: Date): boolean {
  const t = new Date(isoOrDate).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t < end.getTime();
}

/** Project overlaps or was touched in the metrics period. */
export function projectInPeriod(
  project: ProjectWithRelations,
  period: MetricsPeriod
): boolean {
  const { start, end } = periodRange(period);
  if (
    inRange(project.created_at, start, end) ||
    inRange(project.updated_at, start, end)
  ) {
    return true;
  }
  const calStart = projectCalendarStart(project);
  const calEnd = projectCalendarEnd(project);
  const s = new Date(calStart + "T00:00:00").getTime();
  const e = new Date(calEnd + "T23:59:59").getTime();
  return s < end.getTime() && e >= start.getTime();
}

export function filterProjectsByPeriod(
  projects: ProjectWithRelations[],
  period: MetricsPeriod
): ProjectWithRelations[] {
  return projects.filter((p) => projectInPeriod(p, period));
}
