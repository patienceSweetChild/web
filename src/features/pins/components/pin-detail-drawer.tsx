"use client";

import { useEffect, useMemo, useState } from "react";
import { usesFormatPackEditor } from "@/features/boards/config";
import { TagCategoryField } from "@/features/pins/components/tag-category-field";
import {
  FORMAT_KEYS,
  FormatPackEditor,
  applyFormatMetric,
  type PackKey,
} from "@/features/pins/components/format-metrics-editor";
import { usePinCatalog } from "@/features/pins/store/pin-catalog-provider";
import {
  buildFormatChildPins,
  columnToFormatKey,
  isFormatChildPinId,
  isParentPin,
  normalizedStatus,
  renderNotesMarkdown,
  resolvePinNotesMarkdown,
} from "@/features/pins/lib/pin-utils";
import type { BoardId, FormatKey, Pin, TagCategory } from "@/features/pins/types";

export type PinDetailMode = "edit" | "create";

type PinDetailDrawerProps = {
  pin: Pin | null;
  mode: PinDetailMode;
  boardId: BoardId;
  open: boolean;
  onClose: () => void;
  onSave: (pin: Pin) => void;
  onDuplicate?: (pin: Pin, format?: string) => void;
  readOnly?: boolean;
};

const STATUS_OPTIONS = ["Draft", "Active", "Archived"] as const;

const DEFAULT_SUBTYPES: Record<string, string[]> = {
  videos: ["Video", "Video Ads", "UGC", "Reel"],
  images: ["Images", "Image", "Static"],
  print: ["Flyer", "Poster", "Print"],
  web: ["Landing Page", "Web"],
  automation: ["Email / Automation", "Automation", "Online"],
  draft: ["Video", "Images", "Flyer"],
};

const DUP_ACTIONS: { label: string; format?: string }[] = [
  { label: "Duplicate Pin" },
  { label: "Duplicate as Image", format: "image" },
  { label: "Duplicate as Video", format: "video" },
  { label: "Duplicate as Print", format: "print" },
  { label: "Duplicate as Web", format: "web" },
  { label: "Duplicate as Online", format: "automation" },
  { label: "Duplicate as Automation", format: "automation" },
];

function statusToStore(value: string): Pin["status"] {
  if (value === "Draft") return "Draft";
  if (value === "Archived") return "Archived";
  return "Active";
}

/**
 * Slide-over editor for a single pin.
 * Child boards: subtype / status / price + duplicate actions.
 * Parent-trusted boards: output formats / Core Pin Promise.
 */
export function PinDetailDrawer({
  pin,
  mode,
  boardId,
  open,
  onClose,
  onSave,
  onDuplicate,
  readOnly = false,
}: PinDetailDrawerProps) {
  const { catalogs, problems, pins, upsertPin, deletePin } = usePinCatalog();
  const [draft, setDraft] = useState<Pin | null>(null);
  const [picker, setPicker] = useState<TagCategory | null>(null);
  const [openFormats, setOpenFormats] = useState<Set<PackKey>>(new Set());
  const [notesEditing, setNotesEditing] = useState(false);
  const parentStyle = usesFormatPackEditor(boardId);
  const childStyle = !parentStyle;

  useEffect(() => {
    if (!pin) {
      setDraft(null);
      return;
    }
    const next = structuredClone(pin);
    // Legacy view2: empty notes get the Goal / Branch / Best use template.
    next.notes = resolvePinNotesMarkdown(next);
    setDraft(next);
    const initial = new Set<PackKey>();
    const primary = columnToFormatKey(pin.column);
    if (FORMAT_KEYS.includes(primary)) initial.add(primary);
    if (pin.formatAssets) {
      (FORMAT_KEYS as FormatKey[]).forEach((k) => {
        const v = pin.formatAssets?.[k];
        const n = typeof v === "number" ? v : v?.assets;
        if (n && n > 0) initial.add(k);
      });
    }
    if (pin.formatPacks) {
      (Object.keys(pin.formatPacks) as FormatKey[]).forEach((k) => {
        const pack = pin.formatPacks?.[k];
        if (pack && (pack.assets || pack.hooks || pack.angles || pack.executions)) {
          initial.add(k);
        }
      });
    }
    if (!initial.size && parentStyle) initial.add("video");
    setOpenFormats(initial);
    setPicker(null);
    setNotesEditing(false);
  }, [pin, open, parentStyle]);

  useEffect(() => {
    document.body.classList.toggle("pin-detail-open", open);
    return () => document.body.classList.remove("pin-detail-open");
  }, [open]);

  const subtypeOptions = useMemo(() => {
    if (!draft) return DEFAULT_SUBTYPES.videos;
    const column = String(draft.column || "videos");
    const fromPins = Array.from(
      new Set(
        pins
          .filter((p) => String(p.column) === column && p.subtype)
          .map((p) => p.subtype)
      )
    ).sort((a, b) => a.localeCompare(b));
    const defaults = DEFAULT_SUBTYPES[column] || DEFAULT_SUBTYPES.videos;
    const merged = Array.from(new Set([...fromPins, ...defaults]));
    if (draft.subtype && !merged.includes(draft.subtype)) merged.unshift(draft.subtype);
    return merged;
  }, [draft, pins]);

  const optionsFor = useMemo(
    () => ({
      expectedClient: catalogs.expectedClients,
      selling: catalogs.sellingOptions,
      creativePack: catalogs.creativePackOptions,
      fullCampaign: catalogs.fullCampaignOptions,
      talent: catalogs.talentOptions,
      problems: problems.map((p) => p.id),
    }),
    [catalogs, problems]
  );

  if (!open || !draft) return null;

  function update<K extends keyof Pin>(key: K, value: Pin[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function tagsFor(cat: TagCategory): string[] {
    if (cat === "expectedClient") return draft!.expectedClient || [];
    if (cat === "selling") return draft!.selling || [];
    if (cat === "creativePack") return draft!.creativePack || [];
    if (cat === "fullCampaign") return draft!.fullCampaign || [];
    if (cat === "talent") return draft!.talent || [];
    return draft!.problems || [];
  }

  function setTags(cat: TagCategory, values: string[]) {
    if (cat === "expectedClient") update("expectedClient", values);
    else if (cat === "selling") update("selling", values);
    else if (cat === "creativePack") update("creativePack", values);
    else if (cat === "fullCampaign") update("fullCampaign", values);
    else if (cat === "talent") update("talent", values);
    else update("problems", values);
  }

  function handleSave() {
    if (!draft) return;
    const lower = draft.lower || "";
    const higher = draft.higher || "";
    const price =
      lower && higher
        ? lower === higher
          ? lower
          : `${lower}–${higher}`
        : lower || higher || draft.price || "";

    const next: Pin = {
      ...draft,
      price,
      displayTags: draft.displayTags?.length
        ? draft.displayTags
        : [draft.subtype.toUpperCase()],
      footerLabel: draft.footerLabel || draft.subtype,
    };

    // Board Parent creates must stay subtype Parent or they vanish from catalog.
    if (boardId === "catalog" || isParentPin(draft)) {
      next.subtype = "Parent";
      next.tags = ["Parent"];
      next.displayTags = ["PARENT"];
      next.footerLabel = next.footerLabel && next.footerLabel !== draft.subtype
        ? next.footerLabel
        : "Parent";
    }

    const selectedFormats = parentStyle
      ? (FORMAT_KEYS.filter((k) => openFormats.has(k)) as FormatKey[])
      : [];

    if (parentStyle) {
      if (selectedFormats.length) {
        const map: Record<string, Pin["column"]> = {
          video: "videos",
          image: "images",
          print: "print",
          web: "web",
          automation: "automation",
        };
        const primaryFormat = selectedFormats.find((k) => k !== "automation") || selectedFormats[0];
        next.column = map[primaryFormat] || next.column;
      }
      next.hooks = 0;
      next.angles = 0;
      next.executions = 0;
      next.assets = 0;
      selectedFormats.forEach((key) => {
        next.hooks! += Number(next.formatPacks?.[key]?.hooks) || 0;
        next.angles! += Number(next.formatPacks?.[key]?.angles) || 0;
        next.executions! += Number(next.formatPacks?.[key]?.executions) || 0;
        next.assets! +=
          Number(
            typeof next.formatAssets?.[key] === "number"
              ? next.formatAssets?.[key]
              : next.formatPacks?.[key]?.assets
          ) || 0;
      });
    }

    onSave(next);

    // Parent pins: project each selected format onto Board Child (+ tag boards via tags).
    if (isParentPin(next) || boardId === "catalog") {
      const children = buildFormatChildPins(next, selectedFormats);
      const keepIds = new Set(children.map((c) => c.id));
      const orphans = pins.filter(
        (p) => isFormatChildPinId(p.id, next.id) && !keepIds.has(p.id)
      );
      void (async () => {
        for (const child of children) {
          await upsertPin(child, { boardId });
        }
        for (const orphan of orphans) {
          await deletePin(orphan.id, { boardId });
        }
      })();
    }

    onClose();
  }

  function handleDuplicate(format?: string) {
    if (!draft || !onDuplicate) return;
    onDuplicate(draft, format);
  }

  const tagSections: { cat: TagCategory; label: string; color: "blue" | "purple" }[] = [
    { cat: "expectedClient", label: "EXPECTED CLIENT", color: "blue" },
    { cat: "selling", label: "SELLING", color: "purple" },
    { cat: "creativePack", label: "CREATIVE PACK", color: "blue" },
    { cat: "fullCampaign", label: "FULL CAMPAIGN", color: "purple" },
    { cat: "talent", label: "TALENT REQUIREMENTS", color: "purple" },
    { cat: "problems", label: "PROBLEMS", color: "blue" },
  ];

  const statusValue = normalizedStatus(draft);

  return (
    <div
      className={`pin-detail-backdrop${open ? " open" : ""}`}
      aria-hidden={!open}
      onClick={onClose}
    >
      <aside
        className="pin-detail-drawer"
        id="pin-detail"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-panel">
          <div className="panel-toolbar">
            <span id="panelPinId">{draft.id}</span>
            <span className="star">★</span>
            <span className="spacer" />
            {draft.PM ? <span className="PM-badge">PM</span> : null}
            <div className="state-actions">
              {!readOnly && (
                <button type="button" className="btn-state save" onClick={handleSave}>
                  {mode === "create"
                    ? boardId === "catalog"
                      ? "Create Parent Pin"
                      : boardId === "sell-channels"
                        ? "Create pack"
                        : "Create pin"
                    : "Save"}
                </button>
              )}
              {readOnly && (
                <span className="readonly-badge">View only</span>
              )}
              <button type="button" className="btn-state minimize" onClick={onClose}>
                ▢ Minimize
              </button>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} title="Close">
              ✕
            </button>
          </div>

          <div className="panel-header">
            <div className="panel-title-wrap">
              <label className="field-label" htmlFor="panelTitleInput">
                {boardId === "sell-channels" ? "Pack name" : "Pin name"}
              </label>
              <input
                id="panelTitleInput"
                className="panel-title-input"
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder={boardId === "sell-channels" ? "Pack name" : "Pin name"}
              />
            </div>
          </div>

          {childStyle ? (
            <>
              <div className="field-row">
                <label className="form-field">
                  <span className="field-label">Subtype</span>
                  <select
                    className="field-input field-select"
                    value={draft.subtype}
                    onChange={(e) => {
                      update("subtype", e.target.value);
                      update("footerLabel", e.target.value);
                    }}
                  >
                    {subtypeOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="field-label">Status</span>
                  <select
                    className="field-input field-select"
                    value={statusValue}
                    onChange={(e) => update("status", statusToStore(e.target.value))}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-row">
                <label className="budget-field budget-edit">
                  <span className="blabel">LOWER</span>
                  <input
                    className="field-input field-input-budget"
                    value={draft.lower || ""}
                    placeholder="Not set"
                    onChange={(e) => update("lower", e.target.value)}
                  />
                </label>
                <label className="budget-field budget-edit">
                  <span className="blabel">HIGHER</span>
                  <input
                    className="field-input field-input-budget"
                    value={draft.higher || ""}
                    placeholder="Not set"
                    onChange={(e) => update("higher", e.target.value)}
                  />
                </label>
              </div>
            </>
          ) : null}

          {tagSections.map(({ cat, label, color }) => (
            <TagCategoryField
              key={cat}
              category={cat}
              label={label}
              color={color}
              values={tagsFor(cat)}
              options={optionsFor[cat]}
              resolveLabel={
                cat === "problems"
                  ? (id) => problems.find((p) => p.id === id)?.title || id
                  : undefined
              }
              open={picker === cat}
              onToggleOpen={() => setPicker(picker === cat ? null : cat)}
              onAdd={(v) => {
                setTags(cat, [...tagsFor(cat), v]);
                setPicker(null);
              }}
              onRemove={(v) => setTags(cat, tagsFor(cat).filter((t) => t !== v))}
            />
          ))}

          {parentStyle ? (
            <FormatPackEditor
              draft={draft}
              openFormats={openFormats}
              onToggleFormat={(key) =>
                setOpenFormats((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              onChangeMetric={(key, role, value) =>
                setDraft((d) => (d ? applyFormatMetric(d, key, role, value) : d))
              }
            />
          ) : null}

          <div className={`notes-box${notesEditing ? " editing" : ""}`}>
            <div className="notes-header">
              <span>
                {notesEditing
                  ? "Markdown edit · Done to preview"
                  : "Formatted notes · click to edit"}
              </span>
              <button
                className="notes-done"
                type="button"
                onClick={() => setNotesEditing(false)}
              >
                Done
              </button>
            </div>
            <div
              className="notes-preview"
              onClick={() => setNotesEditing(true)}
              dangerouslySetInnerHTML={{ __html: renderNotesMarkdown(draft.notes || "") }}
            />
            <textarea
              className="notes-editor"
              value={draft.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  setNotesEditing(false);
                }
              }}
              spellCheck
            />
          </div>

          <div className="dup-box">
            <h3>Duplicate and modify</h3>
            <p>
              Create a safe variation, then edit its branch, sub-category, name, price and
              tags above.
            </p>
            <div className="dup-grid">
              {DUP_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  className="dup-btn"
                  type="button"
                  onClick={() => handleDuplicate(action.format)}
                >
                  {boardId === "sell-channels" && action.label === "Duplicate Pin"
                    ? "Duplicate Pack"
                    : action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="client-actions">
            <h3>Expected Client Actions</h3>
            <div className="client-actions-grid">
              <button className="client-action-btn" type="button">
                Move to existing client
              </button>
              <button className="client-action-btn" type="button">
                Move to new client
              </button>
              <button className="client-action-btn" type="button">
                Duplicate to existing client
              </button>
              <button className="client-action-btn" type="button">
                Duplicate to new client
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
