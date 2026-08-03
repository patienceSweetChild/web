"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, UserRole } from "@/features/users/types";
import { ROLE_COLORS, ROLE_LABELS } from "@/features/users/types";
import type { ClientAssignment, CrmClientWithProfiles } from "@/features/clients/types";
import { WorkspaceShell } from "@/features/shell";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import { CLIENT_DISPLAY_LABELS } from "@/features/boards/config";
import { formatDateTime } from "@/lib/format-date";
import {
  addPinsToShortlist,
  checkoutOnboardingShortlist,
  createCrmClientForOnboarding,
  ensureShortlist,
  fetchChatForClient,
  fetchClientHistory,
  fetchShortlistForClient,
  removePinsFromShortlist,
  saveShortlistDiagnosis,
  updateCrmClientProfile,
} from "@/features/onboarding/actions";
import { sendOnboardingChat } from "@/features/onboarding/ai/chat";
import { recommendPinsFromDiagnosis, pinsForExpectedClient } from "@/features/onboarding/lib/recommend";
import { PinsFormatBoard } from "@/features/onboarding/components/pins-format-board";
import {
  AUDIENCE_STAGES,
  CHANNEL_OPTIONS,
  CTA_OPTIONS,
  PIPELINE_OPTIONS,
  type AudienceStage,
  type OnboardingChatMessage,
  type OnboardingDiagnosis,
  type PipelineStatus,
} from "@/features/onboarding/types";
import type { Pin } from "@/features/pins/types";

type Panel = "workspace" | "history";
type SidebarPosition = "left" | "right" | "center";

const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 320;
const SIDEBAR_POS_KEY = "ob-sidebar-position";

function readSidebarPosition(): SidebarPosition {
  if (typeof window === "undefined") return "right";
  const v = window.localStorage.getItem(SIDEBAR_POS_KEY);
  if (v === "left" || v === "right" || v === "center") return v;
  return "right";
}

export function OnboardingPage({
  myProfile,
  clients: initialClients,
}: {
  myProfile: Profile;
  clients: CrmClientWithProfiles[];
}) {
  const router = useRouter();
  const { pins, problems, catalogs } = usePinCatalog();
  const [pending, startTransition] = useTransition();

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>("right");
  const [resizing, setResizing] = useState(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;
  const sidebarPositionRef = useRef(sidebarPosition);
  sidebarPositionRef.current = sidebarPosition;

  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Set when cart is opened so workspace+sidebar only appear after hydrate. */
  const [openedClientId, setOpenedClientId] = useState<string | null>(null);
  const openedClientIdRef = useRef<string | null>(null);
  const [panel, setPanel] = useState<Panel>("workspace");
  const [assignments, setAssignments] = useState<ClientAssignment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPipeline, setNewPipeline] = useState<PipelineStatus>("new");
  const [newClientType, setNewClientType] = useState("");
  const [newBranding, setNewBranding] = useState("");

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  // Profile draft
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pipeline, setPipeline] = useState<PipelineStatus>("new");
  const [clientType, setClientType] = useState("");
  const [branding, setBranding] = useState("");
  const [expectedSearch, setExpectedSearch] = useState("");
  const [activeExpected, setActiveExpected] = useState<string | null>(null);

  // Diagnosis
  const [goal, setGoal] = useState<string | null>(null);
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [audience, setAudience] = useState<AudienceStage>("S5");
  const [cta, setCta] = useState(CTA_OPTIONS[0]);
  const [channel, setChannel] = useState(CHANNEL_OPTIONS[0]);
  const [recommended, setRecommended] = useState<Pin[]>([]);
  const [listPinIds, setListPinIds] = useState<string[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [recView, setRecView] = useState<"kanban" | "list">("kanban");
  const [listView, setListView] = useState<"kanban" | "list">("kanban");

  // Chat
  const [chatMessages, setChatMessages] = useState<OnboardingChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const role = myProfile.role as UserRole;
  const canEdit = role !== "viewer";

  useEffect(() => {
    setSidebarPosition(readSidebarPosition());
  }, []);

  function setSidebarPositionPersist(pos: SidebarPosition) {
    setSidebarPosition(pos);
    try {
      window.localStorage.setItem(SIDEBAR_POS_KEY, pos);
    } catch {
      /* ignore */
    }
  }

  function onSidebarResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidthRef.current;
    const pos = sidebarPositionRef.current;
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      const delta = pos === "left" ? ev.clientX - startX : startX - ev.clientX;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + delta));
      setSidebarWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 12);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company || "").toLowerCase().includes(q) ||
          (c.industry || "").toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [clients, search]);

  const expectedOptions = useMemo(() => {
    const all = catalogs.expectedClients || [];
    const q = expectedSearch.trim().toLowerCase();
    if (!q) return all.slice(0, 12);
    return all.filter((e) => {
      const label = CLIENT_DISPLAY_LABELS[e] || e;
      return e.toLowerCase().includes(q) || label.toLowerCase().includes(q);
    });
  }, [catalogs.expectedClients, expectedSearch]);

  const listPins = useMemo(
    () => listPinIds.map((id) => pins.find((p) => p.id === id)).filter(Boolean) as Pin[],
    [listPinIds, pins]
  );

  const diagnosis: OnboardingDiagnosis = {
    goal,
    problemIds: selectedProblems,
    audience,
    cta,
    channel,
    expectedClient: activeExpected,
  };

  function hydrateClient(c: CrmClientWithProfiles) {
    setSelectedId(c.id);
    setName(c.name);
    setCompany(c.company || "");
    setContact(c.contact_person || "");
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setPipeline((c.pipeline_status as PipelineStatus) || "new");
    setClientType(c.client_type || "");
    setBranding(c.branding || "");
    setPanel("workspace");
  }

  function resetWorkspaceDraft() {
    setGoal(null);
    setSelectedProblems([]);
    setAudience("S5");
    setCta(CTA_OPTIONS[0]);
    setChannel(CHANNEL_OPTIONS[0]);
    setActiveExpected(null);
    setExpectedSearch("");
    setRecommended([]);
    setListPinIds([]);
    setSelectedListIds(new Set());
    setChatMessages([]);
    setChatInput("");
  }

  function openCart(c: CrmClientWithProfiles) {
    // Populate profile sidebar synchronously on the same click that opens the workspace.
    hydrateClient(c);
    openedClientIdRef.current = c.id;
    setOpenedClientId(c.id);
    resetWorkspaceDraft();

    const clientId = c.id;
    startTransition(() => {
      void (async () => {
        try {
          if (canEdit) await ensureShortlist(clientId);
          if (openedClientIdRef.current !== clientId) return;
          const { items, shortlist } = await fetchShortlistForClient(clientId);
          if (openedClientIdRef.current !== clientId) return;
          setListPinIds(items.map((i) => i.pin_id));
          if (shortlist?.diagnosis) {
            const d = shortlist.diagnosis;
            if (d.goal) setGoal(d.goal);
            if (d.problemIds) setSelectedProblems(d.problemIds);
            if (d.audience) setAudience(d.audience);
            if (d.cta) setCta(d.cta);
            if (d.channel) setChannel(d.channel);
            if (d.expectedClient) setActiveExpected(d.expectedClient);
          }
          if (canEdit) {
            const chat = await fetchChatForClient(clientId);
            if (openedClientIdRef.current !== clientId) return;
            setChatMessages(chat.messages);
          } else {
            setChatMessages([]);
          }
        } catch {
          if (openedClientIdRef.current !== clientId) return;
          setListPinIds([]);
          setChatMessages([]);
        }
      })();
    });
  }

  function openHistory(c: CrmClientWithProfiles) {
    hydrateClient(c);
    setPanel("history");
    startTransition(() => {
      void (async () => {
        try {
          const { assignments: a } = await fetchClientHistory(c.id);
          setAssignments(a);
        } catch {
          setAssignments([]);
        }
      })();
    });
  }

  function resetCreateForm() {
    setNewName("");
    setNewCompany("");
    setNewContact("");
    setNewPhone("");
    setNewEmail("");
    setNewPipeline("new");
    setNewClientType("");
    setNewBranding("");
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !canEdit) return;
    const payload = {
      name: newName.trim(),
      company: newCompany.trim() || undefined,
      contact_person: newContact.trim() || undefined,
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      pipeline_status: newPipeline,
      client_type: newClientType.trim() || undefined,
      branding: newBranding.trim() || undefined,
    };
    startTransition(async () => {
      const client = await createCrmClientForOnboarding(payload);
      const enriched = {
        ...client,
        company: payload.company || null,
        contact_person: payload.contact_person || null,
        phone: payload.phone || null,
        email: payload.email || null,
        pipeline_status: payload.pipeline_status,
        client_type: payload.client_type || null,
        branding: payload.branding || null,
      } as CrmClientWithProfiles;
      setClients((prev) => [enriched, ...prev]);
      setShowCreate(false);
      resetCreateForm();
      await openCart(enriched);
      router.refresh();
    });
  }

  function saveProfile() {
    if (!selected || !canEdit) return;
    startTransition(async () => {
      await updateCrmClientProfile(selected.id, {
        name,
        company,
        contact_person: contact,
        phone,
        email,
        pipeline_status: pipeline,
        client_type: clientType,
        branding,
      });
      setClients((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                name,
                company,
                contact_person: contact,
                phone,
                email,
                pipeline_status: pipeline,
                client_type: clientType,
                branding,
              }
            : c
        )
      );
    });
  }

  function toggleProblem(id: string) {
    setSelectedProblems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function runRecommend() {
    if (!selected || !canEdit) return;
    const matched = recommendPinsFromDiagnosis(pins, diagnosis);
    setRecommended(matched);
    const ids = matched.map((p) => p.id);
    startTransition(async () => {
      await saveShortlistDiagnosis(selected.id, diagnosis);
      await addPinsToShortlist(selected.id, ids, "recommend");
      setListPinIds((prev) => Array.from(new Set([...prev, ...ids])));
    });
  }

  function addStarterPins(tag: string) {
    if (!selected || !canEdit) return;
    setActiveExpected(tag);
    const matched = pinsForExpectedClient(pins, tag);
    const ids = matched.map((p) => p.id);
    setRecommended(matched);
    startTransition(async () => {
      await addPinsToShortlist(selected.id, ids, "starter");
      setListPinIds((prev) => Array.from(new Set([...prev, ...ids])));
    });
  }

  function removeFromList(pinId: string) {
    if (!selected || !canEdit) return;
    setListPinIds((prev) => prev.filter((id) => id !== pinId));
    setRecommended((prev) => prev.filter((p) => p.id !== pinId));
    startTransition(async () => {
      await removePinsFromShortlist(selected.id, [pinId]);
    });
  }

  function bulkRemoveSelected() {
    if (!selected || !canEdit || selectedListIds.size === 0) return;
    const ids = Array.from(selectedListIds);
    setListPinIds((prev) => prev.filter((id) => !selectedListIds.has(id)));
    setSelectedListIds(new Set());
    startTransition(async () => {
      await removePinsFromShortlist(selected.id, ids);
    });
  }

  function toggleListSelect(pinId: string) {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(pinId)) next.delete(pinId);
      else next.add(pinId);
      return next;
    });
  }

  function handleCheckout() {
    if (!selected || !canEdit || listPinIds.length === 0) return;
    startTransition(async () => {
      const { projectId } = await checkoutOnboardingShortlist(selected.id, name || selected.name);
      router.push(`/projects/${projectId}`);
    });
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !canEdit || !chatInput.trim() || chatBusy) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatBusy(true);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        thread_id: "",
        role: "user",
        content: msg,
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const result = await sendOnboardingChat({
        clientId: selected.id,
        message: msg,
        clientSummary: JSON.stringify({
          name,
          company,
          contact,
          phone,
          email,
          pipeline,
          clientType,
          branding,
          expectedClient: activeExpected,
        }),
        diagnosis,
        catalogPins: pins.map((p) => ({
          id: p.id,
          name: p.name,
          problems: p.problems,
          expectedClient: p.expectedClient,
          creativePack: p.creativePack,
          column: String(p.column),
          branch: String(p.branch),
        })),
        problems: problems.map((p) => ({ id: p.id, title: p.title })),
      });
      setChatMessages((prev) => [
        ...prev,
        {
          id: `tmp-a-${Date.now()}`,
          thread_id: "",
          role: "assistant",
          content: result.reply,
          created_at: new Date().toISOString(),
        },
      ]);
      if (result.addPinIds.length) {
        setListPinIds((prev) => Array.from(new Set([...prev, ...result.addPinIds])));
        const added = pins.filter((p) => result.addPinIds.includes(p.id));
        setRecommended(added);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `tmp-err-${Date.now()}`,
          thread_id: "",
          role: "assistant",
          content: err instanceof Error ? err.message : "Chat failed",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  const goalOptions = (catalogs.creativePackOptions || []).filter((g) =>
    ["Lead", "Direct Sell", "Scale"].includes(g)
  );

  return (
    <WorkspaceShell
      title="Onboarding"
      crumbs={[
        { label: "Boards", href: "/boards/catalog" },
        { label: "Onboarding" },
      ]}
      projectType="Onboarding"
      profile={myProfile}
    >
      <div className="content ob-page">
        {/* Client search */}
        <section className="ob-search-panel">
          <div className="ob-search-head">
            <span className="ob-client-badge">C</span>
            <div>
              <h2 className="ob-section-title">Real client profile — required before checkout</h2>
              <p className="ob-muted">
                Search an existing client, open their cart (sidebar), or view history. Create a new
                client if none match.
              </p>
            </div>
          </div>
          <input
            className="search ob-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name or company…"
          />
          <div className="ob-client-cards">
            {filteredClients.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ob-client-card${active ? " active" : ""}`}
                  onClick={() => {
                    setSelectedId(c.id);
                    if (openedClientId !== c.id) {
                      openedClientIdRef.current = null;
                      setOpenedClientId(null);
                    }
                  }}
                >
                  <div className="ob-client-card-main">
                    <strong>{c.name}</strong>
                    <span className="ob-muted">{c.company || c.industry || "—"}</span>
                  </div>
                </button>
              );
            })}
            {filteredClients.length === 0 && (
              <div className="ob-empty">No clients found. Create a new client below.</div>
            )}
          </div>
          <div className="ob-search-actions">
            {selected && (
              <>
                <span className="ob-cart-status">
                  Active cart: {selected.name} — {listPinIds.length} Pins
                </span>
                <button type="button" className="btn" disabled={pending} onClick={() => openCart(selected)}>
                  Open client cart
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={pending || !canEdit || listPinIds.length === 0}
                  onClick={handleCheckout}
                >
                  Checkout this client cart
                </button>
                <button type="button" className="btn" disabled={pending} onClick={() => openHistory(selected)}>
                  View order history
                </button>
              </>
            )}
            {canEdit && (
              <button type="button" className="btn" onClick={() => setShowCreate(true)}>
                + Create new client
              </button>
            )}
          </div>
        </section>

        {showCreate && (
          <div
            className="picker-backdrop open"
            onClick={() => {
              setShowCreate(false);
              resetCreateForm();
            }}
          >
            <div
              className="picker-modal project-create-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="picker-head">
                <h2>Create client</h2>
                <button
                  type="button"
                  className="btn btn-ghost picker-close"
                  onClick={() => {
                    setShowCreate(false);
                    resetCreateForm();
                  }}
                >
                  ✕
                </button>
              </div>
              <form className="project-create-form" onSubmit={handleCreate}>
                <label className="project-field">
                  <span>Client / Project Name *</span>
                  <input
                    className="search"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Acme Corp launch"
                    required
                    autoFocus
                  />
                </label>
                <label className="project-field">
                  <span>Company</span>
                  <input
                    className="search"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="Legal / trading name"
                  />
                </label>
                <label className="project-field">
                  <span>Contact Person</span>
                  <input
                    className="search"
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    placeholder="Primary contact"
                  />
                </label>
                <div className="project-create-row">
                  <label className="project-field">
                    <span>Phone</span>
                    <input
                      className="search"
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+1 …"
                    />
                  </label>
                  <label className="project-field">
                    <span>Email</span>
                    <input
                      className="search"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="name@company.com"
                    />
                  </label>
                </div>
                <label className="project-field">
                  <span>Pipeline Status</span>
                  <select
                    className="search"
                    value={newPipeline}
                    onChange={(e) => setNewPipeline(e.target.value as PipelineStatus)}
                  >
                    {PIPELINE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="project-create-row">
                  <label className="project-field">
                    <span>Client Type</span>
                    <input
                      className="search"
                      value={newClientType}
                      onChange={(e) => setNewClientType(e.target.value)}
                      placeholder="e.g. D2C, SaaS"
                    />
                  </label>
                  <label className="project-field">
                    <span>Branding</span>
                    <input
                      className="search"
                      value={newBranding}
                      onChange={(e) => setNewBranding(e.target.value)}
                      placeholder="Tone, colors, notes"
                    />
                  </label>
                </div>
                <div className="assign-modal-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setShowCreate(false);
                      resetCreateForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pending || !newName.trim()}
                  >
                    {pending ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selected && panel === "history" && (
          <section className="ob-history-panel">
            <div className="ob-pins-board-header">
              <h3 className="ob-section-title">Client history — {selected.name}</h3>
              <Link className="btn" href={`/clients/${selected.id}?tab=history`}>
                Open full client page
              </Link>
            </div>
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-dot timeline-dot-create">+</div>
                <div className="timeline-body">
                  <div className="timeline-title">Client created</div>
                  <div className="timeline-meta">
                    by {selected.creator?.full_name || selected.creator?.email || "Unknown"} ·{" "}
                    {formatDateTime(selected.created_at)}
                  </div>
                </div>
              </div>
              {assignments.map((a) => {
                const arc = a.assignee
                  ? ROLE_COLORS[a.assignee.role as UserRole]
                  : ROLE_COLORS.viewer;
                return (
                  <div key={a.id} className="timeline-item">
                    <div className="timeline-dot timeline-dot-assign">→</div>
                    <div className="timeline-body">
                      <div className="timeline-title">
                        Assigned to{" "}
                        <strong>
                          {a.assignee?.full_name || a.assignee?.email?.split("@")[0] || "Unknown"}
                        </strong>
                        {a.assignee && (
                          <span
                            style={{
                              marginLeft: 6,
                              background: arc.bg,
                              color: arc.text,
                              border: `1px solid ${arc.border}`,
                              padding: "1px 6px",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {ROLE_LABELS[a.assignee.role as UserRole]}
                          </span>
                        )}
                      </div>
                      <div className="timeline-meta">
                        by {a.assigner?.full_name || a.assigner?.email || "Unknown"} ·{" "}
                        {formatDateTime(a.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {selected && openedClientId === selected.id && panel === "workspace" && (
          <div
            className={`ob-workspace ob-workspace--${sidebarPosition}${resizing ? " is-resizing" : ""}`}
            style={
              sidebarPosition === "center"
                ? undefined
                : sidebarPosition === "left"
                  ? { gridTemplateColumns: `${sidebarWidth}px 1fr` }
                  : { gridTemplateColumns: `1fr ${sidebarWidth}px` }
            }
          >
            {/* Sidebar */}
            <div className="ob-sidebar-wrap">
              <div
                className="ob-sidebar-resize"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize client profile"
                aria-valuenow={sidebarWidth}
                aria-valuemin={SIDEBAR_MIN}
                aria-valuemax={SIDEBAR_MAX}
                onPointerDown={onSidebarResizeStart}
              />
              <aside className="ob-sidebar">
              <div className="ob-sidebar-head">
                <h3>Client profile</h3>
                <div className="ob-sidebar-head-actions">
                  <div className="ob-pos-toggle" role="group" aria-label="Profile position">
                    {(
                      [
                        { id: "left", label: "Left" },
                        { id: "center", label: "Center" },
                        { id: "right", label: "Right" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={sidebarPosition === opt.id ? "active" : ""}
                        onClick={() => setSidebarPositionPersist(opt.id)}
                        title={`Place profile ${opt.label.toLowerCase()}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <span className="ob-pipeline-pill">
                    {PIPELINE_OPTIONS.find((p) => p.value === pipeline)?.label || "New"}
                  </span>
                </div>
              </div>

              <div className="ob-sidebar-body">
              <div className="ob-sidebar-fields">
              <label className="field">
                <span>Client / Project Name</span>
                <input className="search" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span>Company</span>
                <input className="search" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="field">
                <span>Contact Person</span>
                <input className="search" value={contact} onChange={(e) => setContact(e.target.value)} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input className="search" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="field">
                <span>Email</span>
                <input className="search" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                <span>Pipeline Status</span>
                <select
                  className="search"
                  value={pipeline}
                  onChange={(e) => setPipeline(e.target.value as PipelineStatus)}
                >
                  {PIPELINE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Client Type</span>
                <input
                  className="search"
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Branding</span>
                <input
                  className="search"
                  value={branding}
                  onChange={(e) => setBranding(e.target.value)}
                />
              </label>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary ob-sidebar-save"
                  disabled={pending}
                  onClick={saveProfile}
                >
                  Save profile
                </button>
              )}
              </div>

              <div className="ob-expected">
                <div className="nav-section-label">EXPECTED CLIENT SEARCH</div>
                <input
                  className="search"
                  value={expectedSearch}
                  onChange={(e) => setExpectedSearch(e.target.value)}
                  placeholder="restaurant, school, SaaS, D2C…"
                />
                <div className="ob-expected-list">
                  {expectedOptions.map((tag) =>
                    sidebarPosition === "center" ? (
                      <button
                        key={tag}
                        type="button"
                        className={`ob-expected-chip${activeExpected === tag ? " active" : ""}`}
                        disabled={!canEdit || pending}
                        onClick={() => addStarterPins(tag)}
                      >
                        {CLIENT_DISPLAY_LABELS[tag] || tag}
                      </button>
                    ) : (
                      <div key={tag} className="ob-expected-row">
                        <button
                          type="button"
                          className={`ob-expected-chip${activeExpected === tag ? " active" : ""}`}
                          onClick={() => setActiveExpected(tag)}
                        >
                          {CLIENT_DISPLAY_LABELS[tag] || tag}
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => addStarterPins(tag)}
                            disabled={pending}
                          >
                            Add starter Pins to list
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="ob-chat">
                <div className="nav-section-label">AI ASSISTANT (GROQ)</div>
                <div className="ob-chat-log">
                  {chatMessages.length === 0 && (
                    <p className="ob-muted">
                      Type notes about the client. Groq will reply and auto-add recommended pins.
                    </p>
                  )}
                  {chatMessages.map((m) => (
                    <div key={m.id} className={`ob-chat-bubble ${m.role}`}>
                      {m.content}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <form className="ob-chat-form" onSubmit={sendChat}>
                    <textarea
                      className="search ob-chat-input"
                      rows={3}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Audit, objections, offer, follow-up notes…"
                    />
                    <button type="submit" className="btn btn-primary" disabled={chatBusy || !chatInput.trim()}>
                      {chatBusy ? "Thinking…" : "Send & recommend"}
                    </button>
                  </form>
                )}
              </div>
              </div>
            </aside>
            </div>

            {/* Main diagnosis + recommendations */}
            <main className="ob-main">
              <h2 className="ob-section-title">Business problem diagnosis</h2>

              <div className="ob-step">
                <div className="ob-step-label">Step 1 — Lead / Sell / Scale</div>
                <div className="ob-goal-row">
                  {(goalOptions.length ? goalOptions : ["Lead", "Direct Sell", "Scale"]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`ob-goal-card${goal === g ? " active" : ""}`}
                      onClick={() => setGoal(g)}
                    >
                      {g === "Direct Sell" ? "Sell" : g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ob-step">
                <div className="ob-step-label">Step 2–3 — Exact problems</div>
                <div className="ob-problem-grid">
                  {problems.slice(0, 48).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`ob-problem-card${selectedProblems.includes(p.id) ? " active" : ""}`}
                      onClick={() => toggleProblem(p.id)}
                    >
                      <strong>{p.title}</strong>
                      <span className="ob-muted">{p.letter}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ob-step">
                <div className="ob-step-label">Step 4 — Audience awareness</div>
                <div className="ob-audience-row">
                  {AUDIENCE_STAGES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`ob-audience-btn${audience === s.id ? " active" : ""}`}
                      onClick={() => setAudience(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="ob-filters-row">
                  <label className="field">
                    <span>CTA</span>
                    <select className="search" value={cta} onChange={(e) => setCta(e.target.value)}>
                      {CTA_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>CHANNEL</span>
                    <select
                      className="search"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    >
                      {CHANNEL_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canEdit || pending}
                    onClick={runRecommend}
                  >
                    Recommend Pins
                  </button>
                </div>
              </div>

              <PinsFormatBoard
                title="Recommended Pins"
                subtitle={`${recommended.length} Pins mapped from diagnosis`}
                pins={recommended}
                view={recView}
                onViewChange={setRecView}
                onRemove={canEdit ? removeFromList : undefined}
                emptyLabel="Run Recommend Pins or chat with Groq to populate recommendations."
              />

              <PinsFormatBoard
                title="Current list"
                subtitle={`${listPins.length} pins ready for checkout`}
                pins={listPins}
                view={listView}
                onViewChange={setListView}
                selectedIds={selectedListIds}
                onToggleSelect={toggleListSelect}
                onRemove={canEdit ? removeFromList : undefined}
                emptyLabel="No pins on the current list yet."
                actions={
                  <>
                    {canEdit && selectedListIds.size > 0 && (
                      <button type="button" className="btn" onClick={bulkRemoveSelected} disabled={pending}>
                        Bulk remove ({selectedListIds.size})
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={pending || listPinIds.length === 0}
                        onClick={handleCheckout}
                      >
                        Checkout
                      </button>
                    )}
                  </>
                }
              />
            </main>
          </div>
        )}

        {!selected && (
          <div className="ob-empty" style={{ marginTop: 24 }}>
            Select a client and click <strong>Open client cart</strong> to populate the sidebar and
            start diagnosis.
          </div>
        )}
        {selected && openedClientId !== selected.id && panel === "workspace" && (
          <div className="ob-empty" style={{ marginTop: 24 }}>
            Click <strong>Open client cart</strong> to populate the sidebar and start diagnosis for{" "}
            {selected.name}.
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
