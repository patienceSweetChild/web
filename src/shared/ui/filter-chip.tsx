"use client";

type FilterChipProps = {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
};

/** Board filter tag — uses legacy `.chip` styles from shell.css. */
export function FilterChip({
  active,
  children,
  onClick,
  type = "button",
  className = "",
}: FilterChipProps) {
  return (
    <button
      type={type}
      className={`chip${active ? " active" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
