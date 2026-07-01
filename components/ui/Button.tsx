import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared CTA/button (Cloud Design). `red` = primary (brand red + glow),
 * `inverted` = high-emphasis (SYNC NOW / Sign in), `outline` = gold outline,
 * `ghost` = quiet. Renders a `<Link>` when `href` is set, else a `<button>`.
 */
type Variant = "red" | "inverted" | "outline" | "ghost";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  red: "bg-red text-white hover:bg-red-hover shadow-glow",
  inverted: "bg-inverted text-inverted-fg hover:opacity-90",
  outline: "border border-gold text-gold hover:bg-raised",
  ghost: "text-secondary hover:bg-raised hover:text-primary",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
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
  "aria-label"?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-60 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {children}
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
      {children}
    </button>
  );
}
