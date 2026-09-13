import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared CTA/button (Programme redesign). `red` = the primary (ink fill, paper
 * text, small caps - .btn-grad-red kept its name so older call sites reskin
 * for free; `shine` is a retired no-op); `inverted` = the same solid (kept as
 * a distinct variant name for call-site compatibility); `outline` = 2px ink
 * box; `ghost` = quiet. Square corners throughout. Renders a `<Link>` when
 * `href` is set, else a `<button>`.
 */
type Variant = "red" | "inverted" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  red: "btn-grad-red",
  inverted: "bg-inverted text-inverted-fg hover:opacity-90",
  outline: "border-2 border-primary text-primary hover:bg-raised",
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
  const cls = `inline-flex items-center justify-center gap-1.5 font-semibold transition-colors disabled:opacity-60 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
  // `shine` is retired (Programme has no specular sweep); the prop is kept so
  // call sites keep compiling, and renders nothing.
  void shine;
  const inner = <>{children}</>;
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
