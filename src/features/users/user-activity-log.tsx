"use client";

import { useEffect, useState, useTransition } from "react";
import {
  clearOtherSessions,
  getUserLoginEvents,
  type LoginEvent,
} from "@/features/users/actions";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatDuration(start: string, end: string | null) {
  if (!end) return "Active";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0 || Number.isNaN(ms)) return "—";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:00`;
  return `0:${String(m).padStart(2, "0")}:00`;
}

function agentLabel(ua: string | null) {
  if (!ua) return "—";
  if (/mobile/i.test(ua)) return "Mobile";
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Browser";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Browser";
}

function referrerHost(ref: string | null) {
  if (!ref) return "—";
  try {
    return new URL(ref).host || ref;
  } catch {
    return ref;
  }
}

export function UserActivityLog({ userId }: { userId: string }) {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    setLoading(true);
    setError(null);
    getUserLoginEvents(userId)
      .then(setEvents)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load activity")
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when user changes
  }, [userId]);

  const sessions = events.filter((e) => !e.ended_at);
  const history = events;

  function handleClearOther() {
    startTransition(async () => {
      try {
        await clearOtherSessions(userId);
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear sessions");
      }
    });
  }

  if (loading) {
    return <p className="activity-muted">Loading activity…</p>;
  }

  if (error) {
    return (
      <div className="activity-error">
        <p>{error}</p>
        <p className="activity-muted">
          If this is the first time, run <code>supabase/user-activity.sql</code> in
          the Supabase SQL Editor.
        </p>
      </div>
    );
  }

  return (
    <div className="activity-log">
      <div className="activity-block">
        <div className="activity-block-head">
          <h3 className="activity-block-title">Sessions</h3>
          <button
            type="button"
            className="btn btn-ghost activity-clear-btn"
            disabled={pending || sessions.length <= 1}
            onClick={handleClearOther}
          >
            Clear all other sessions
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="activity-muted">No active sessions recorded.</p>
        ) : (
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Started Time</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{formatWhen(s.started_at)}</td>
                    <td>{s.ip_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="activity-block">
        <div className="activity-block-head">
          <h3 className="activity-block-title">Login History</h3>
        </div>
        {history.length === 0 ? (
          <p className="activity-muted">No login history yet.</p>
        ) : (
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Service Name</th>
                  <th>IP Address</th>
                  <th>Login Time</th>
                  <th>Duration</th>
                  <th>User Agent</th>
                  <th>Referrer</th>
                </tr>
              </thead>
              <tbody>
                {history.map((e) => (
                  <tr key={e.id}>
                    <td>{e.service_name}</td>
                    <td>{e.ip_address || "—"}</td>
                    <td>{formatWhen(e.started_at)}</td>
                    <td>{formatDuration(e.started_at, e.ended_at)}</td>
                    <td>{agentLabel(e.user_agent)}</td>
                    <td>{referrerHost(e.referrer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
