"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectWithRelations } from "../types";
import {
  PROJECT_STATUS_COLORS,
  projectCalendarEnd,
  projectCalendarStart,
} from "../types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
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

const MAX_CHIPS = 3;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetweenInclusive(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  const cur = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (end < cur) {
    out.push(startKey);
    return out;
  }
  while (cur <= end) {
    out.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Monday-first month grid cells (null = padding). */
function buildMonthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=Sun … 6=Sat → Mon-first offset
  const startOffset = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function ProjectDayCalendar({
  projects,
}: {
  projects: ProjectWithRelations[];
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const todayKey = toDateKey(today);

  const byDay = useMemo(() => {
    const map = new Map<string, ProjectWithRelations[]>();
    for (const p of projects) {
      const start = projectCalendarStart(p);
      const end = projectCalendarEnd(p);
      for (const key of daysBetweenInclusive(start, end)) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
      }
    }
    return map;
  }, [projects]);

  function prevMonth() {
    setCursor(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCursor(new Date(year, month + 1, 1));
  }
  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <div className="project-cal">
      <div className="project-cal-toolbar">
        <button type="button" className="btn" onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <h3 className="project-cal-title">
          {MONTH_LONG[month]} {year}
        </h3>
        <button type="button" className="btn" onClick={nextMonth} aria-label="Next month">
          ›
        </button>
        <button type="button" className="btn project-cal-today" onClick={goToday}>
          Today
        </button>
      </div>

      <div className="project-cal-weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="project-cal-weekday">
            {d}
          </div>
        ))}
      </div>

      <div className="project-cal-grid">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={`pad-${i}`} className="project-cal-cell pad" />;
          }
          const key = toDateKey(date);
          const dayProjects = byDay.get(key) ?? [];
          const visible = dayProjects.slice(0, MAX_CHIPS);
          const overflow = dayProjects.length - visible.length;
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={`project-cal-cell${isToday ? " today" : ""}`}
            >
              <div className="project-cal-daynum">{date.getDate()}</div>
              <div className="project-cal-events">
                {visible.map((p) => {
                  const sc = PROJECT_STATUS_COLORS[p.status];
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="project-cal-chip"
                      title={p.name}
                      style={{
                        background: sc.bg,
                        color: sc.text,
                        borderColor: sc.border,
                      }}
                    >
                      {p.name}
                    </Link>
                  );
                })}
                {overflow > 0 && (
                  <span className="project-cal-more">+{overflow} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
