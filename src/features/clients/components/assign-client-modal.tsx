"use client";

import { useEffect, useMemo, useState } from "react";
import type { CrmClient } from "@/features/clients/types";
import { STATUS_LABELS } from "@/features/clients/types";
import { SearchAutocomplete } from "@/shared/ui";

type AssignClientModalProps = {
  open: boolean;
  clients: CrmClient[];
  pending?: boolean;
  onClose: () => void;
  onAssign: (clientId: string, note?: string) => void;
};

export function AssignClientModal({
  open,
  clients,
  pending = false,
  onClose,
  onAssign,
}: AssignClientModalProps) {
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => {
      setQuery("");
      setClientId("");
      setNote("");
    });
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry?.toLowerCase().includes(q) ?? false)
    );
  }, [clients, query]);

  if (!open) return null;

  function close() {
    onClose();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    onAssign(clientId, note.trim() || undefined);
  }

  return (
    <div
      className="picker-backdrop open"
      role="presentation"
      onClick={close}
    >
      <div
        className="picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignClientTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-head">
          <h2 id="assignClientTitle">Assign client</h2>
          <button
            type="button"
            className="btn btn-ghost picker-close"
            onClick={close}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <SearchAutocomplete
          wrapClassName="search-wrap picker-search"
          value={query}
          onChange={setQuery}
          suggestions={clients.map((c) => ({
            id: c.id,
            label: c.name,
            meta: c.industry || STATUS_LABELS[c.status],
          }))}
          placeholder="Search clients…"
          autoFocus
          recentKey="ac:assign-client"
        />

        <div className="picker-list">
          {!filtered.length ? (
            <div className="picker-empty">
              {clients.length === 0
                ? "No unassigned clients available."
                : "No matching clients."}
            </div>
          ) : (
            filtered.map((c) => {
              const selected = clientId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`picker-item${selected ? " active" : ""}`}
                  onClick={() => setClientId(c.id)}
                  style={selected ? { background: "var(--jira-blue-soft)" } : undefined}
                >
                  <span className="picker-item-name">
                    {c.name}
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: "var(--jira-muted)",
                      }}
                    >
                      {c.industry ?? STATUS_LABELS[c.status]}
                    </span>
                  </span>
                  {selected && <span style={{ color: "var(--jira-blue)" }}>✓</span>}
                </button>
              );
            })
          )}
        </div>

        <form onSubmit={submit} className="assign-modal-footer">
          <label className="assign-modal-note-label">
            Note (optional)
            <input
              className="search"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a handoff note…"
            />
          </label>
          <div className="assign-modal-actions">
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!clientId || pending}
            >
              {pending ? "Assigning…" : "Assign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
