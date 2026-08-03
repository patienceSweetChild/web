"use client";

type KanbanColumnProps = {
  title: string;
  subtitle?: string;
  count: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  expandable?: boolean;
  onExpand?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function KanbanColumn({
  title,
  subtitle,
  count,
  collapsed,
  onToggleCollapse,
  expandable,
  onExpand,
  children,
  className = "",
}: KanbanColumnProps) {
  const titleHtml = subtitle ? (
    <div className="kanban-head-text">
      <span>{title}</span>
      <span className="kanban-sub">{subtitle}</span>
    </div>
  ) : (
    <span>{title}</span>
  );

  if (collapsed) {
    return (
      <section className={`kanban-col is-collapsed ${className}`.trim()}>
        <button
          type="button"
          className="col-collapsed-btn"
          onClick={onToggleCollapse}
          title={`Expand ${title}`}
        >
          <span className="col-collapsed-label">{title}</span>
          <span className="kanban-count">{count}</span>
          <span className="col-collapsed-chevron">▸</span>
        </button>
      </section>
    );
  }

  return (
    <section className={`kanban-col ${className}`.trim()}>
      <div className="kanban-head">
        <div
          className="kanban-head-main"
          role="button"
          tabIndex={0}
          onClick={onToggleCollapse}
          onKeyDown={(e) => {
            if (e.key === "Enter") onToggleCollapse?.();
          }}
          title={`Collapse ${title}`}
        >
          <button type="button" className="col-collapse-btn" tabIndex={-1} aria-hidden="true">
            ▾
          </button>
          {titleHtml}
          <span className="kanban-count">{count}</span>
        </div>
        {expandable ? (
          <button
            type="button"
            className="col-expand-btn"
            title="Flat lay view"
            aria-label={`Expand ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onExpand?.();
            }}
          >
            <svg
              className="col-expand-icon"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M1.5 1.5h4.25v1.5H3v2.75H1.5V1.5zm8.75 0H14.5v4.25H13V3h-2.75V1.5zM1.5 10.25H3V13h2.75v1.5H1.5V10.25zM13 10.25h1.5V14.5H10.25V13H13v-2.75z"
              />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="kanban-body">{children}</div>
    </section>
  );
}
