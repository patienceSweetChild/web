"use client";

import type { TagCategory } from "@/features/pins/types";

type TagCategoryFieldProps = {
  label: string;
  color: "blue" | "purple";
  category: TagCategory;
  values: string[];
  options: string[];
  resolveLabel?: (value: string) => string;
  open: boolean;
  onToggleOpen: () => void;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
};

/** Reusable tagged multi-select used across pin detail and problem editors. */
export function TagCategoryField({
  label,
  color,
  values,
  options,
  resolveLabel = (v) => v,
  open,
  onToggleOpen,
  onAdd,
  onRemove,
}: TagCategoryFieldProps) {
  return (
    <div className="tag-category">
      <div className="section-label">{label}</div>
      <div className="pill-wrap">
        {values.map((t) => (
          <span className={`pill ${color}`} key={t}>
            {resolveLabel(t)}{" "}
            <button type="button" className="x" onClick={() => onRemove(t)}>
              ×
            </button>
          </span>
        ))}
        <div className="tag-picker">
          <button type="button" className="add-pill" onClick={onToggleOpen}>
            + tag
          </button>
          {open ? (
            <div className="tag-picker-menu open">
              {options
                .filter((o) => !values.includes(o))
                .map((o) => (
                  <button
                    type="button"
                    key={o}
                    className="tag-picker-item"
                    onClick={() => onAdd(o)}
                  >
                    {resolveLabel(o)}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
