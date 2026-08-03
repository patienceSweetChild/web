"use client";

import Link from "next/link";

export type Crumb = {
  label: string;
  href?: string;
};

export function PageBreadcrumb({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  const parent = [...items]
    .slice(0, -1)
    .reverse()
    .find((item) => Boolean(item.href));

  return (
    <nav className="page-breadcrumb" aria-label="Breadcrumb">
      {parent?.href ? (
        <Link
          href={parent.href}
          className="page-breadcrumb-back"
          title={`Back to ${parent.label}`}
          aria-label={`Back to ${parent.label}`}
        >
          ←
        </Link>
      ) : null}
      <ol className="page-breadcrumb-list">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="page-breadcrumb-item">
              {i > 0 ? (
                <span className="page-breadcrumb-sep" aria-hidden="true">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link href={item.href} className="page-breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "page-breadcrumb-current"
                      : "page-breadcrumb-muted"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
