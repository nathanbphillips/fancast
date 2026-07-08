import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared CTA/button (Matchday redesign). `red` = primary gradient + glow with an
 * opt-in `shine` sweep (for hero/nav CTAs); `inverted` = high-emphasis solid;
 * `outline` = neutral hairline (gold retired); `ghost` = quiet. Renders a
 * `<Link>` when `href` is set, else a `<button>`.
 */
type Variant = "red" | "inverted" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  red: "btn-grad-red text-white",
  inverted: "bg-inverted text-inverted-fg hover:opacity-90",
  outline: "border border-line text-primary hover:bg-raised",
  ghost: "text-secondary hover:bg-raised hover:text-primary",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-[54px] px-7 text-[15px]",
};

export function Button({
  children,
  variant = "red",
  size = "md",
  href,
  type = "button",
  onClick,
  disabled = false,
  className = "",
  shine = false,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** specular sweep — only meaningful on the red variant, for hero/nav CTAs */
  shine?: boolean;
  "aria-label"?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-1.5 rounded-[11px] font-semibold transition-colors disabled:opacity-60 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
  const inner = (
    <>
      {children}
      {shine && variant === "red" ? (
        <span aria-hidden="true" className="btn-shine" />
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cls}
    >
      {inner}
    </button>
  );
}
