import type { UserMetrics } from "@/features/users/components/user-pin-card";
import type { ClientStatus } from "@/features/clients/types";

export type PeriodGranularity = "month" | "quarter" | "year";

export type MetricsPeriod = {
  granularity: PeriodGranularity;
  /** Calendar year */
  year: number;
  /** 0–11 when granularity is month */
  month: number;
  /** 0–3 when granularity is quarter */
  quarter: number;
};

export type ClientMetricEvent = {
  assigned_to: string | null;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function currentMetricsPeriod(now = new Date()): MetricsPeriod {
  const month = now.getMonth();
  return {
    granularity: "month",
    year: now.getFullYear(),
    month,
    quarter: Math.floor(month / 3),
  };
}

/** Inclusive start, exclusive end (local calendar). */
export function periodRange(period: MetricsPeriod): { start: Date; end: Date } {
  const { year, granularity } = period;
  if (granularity === "year") {
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
  }
  if (granularity === "quarter") {
    const startMonth = period.quarter * 3;
    return {
      start: new Date(year, startMonth, 1),
      end: new Date(year, startMonth + 3, 1),
    };
  }
  return {
    start: new Date(year, period.month, 1),
    end: new Date(year, period.month + 1, 1),
  };
}

export function formatPeriodLabel(period: MetricsPeriod): string {
  if (period.granularity === "year") return String(period.year);
  if (period.granularity === "quarter") {
    return `Q${period.quarter + 1} ${period.year}`;
  }
  return `${MONTH_SHORT[period.month]} ${period.year}`;
}

export function formatPeriodTitle(period: MetricsPeriod): string {
  if (period.granularity === "year") return `Year ${period.year}`;
  if (period.granularity === "quarter") {
    const start = period.quarter * 3;
    return `Q${period.quarter + 1} ${period.year} (${MONTH_SHORT[start]}–${MONTH_SHORT[start + 2]})`;
  }
  return `${MONTH_LONG[period.month]} ${period.year}`;
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t < end.getTime();
}

const EMPTY: UserMetrics = {
  visibleProjects: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
};

/**
 * Period-scoped user metrics from CRM clients assigned in the selected range.
 * A client counts if created or last updated in the period.
 */
export function buildPeriodMetricsByUser(
  userIds: string[],
  events: ClientMetricEvent[],
  period: MetricsPeriod
): Record<string, UserMetrics> {
  const { start, end } = periodRange(period);
  const out: Record<string, UserMetrics> = {};
  for (const id of userIds) {
    out[id] = { ...EMPTY };
  }

  for (const e of events) {
    if (!e.assigned_to || !out[e.assigned_to]) continue;
    const touched =
      inRange(e.created_at, start, end) || inRange(e.updated_at, start, end);
    if (!touched) continue;

    const m = out[e.assigned_to];
    m.visibleProjects += 1;
    if (e.status === "active") m.approved += 1;
    else if (e.status === "closed") m.rejected += 1;
    else m.pending += 1;
  }

  return out;
}

export { MONTH_SHORT, MONTH_LONG };
