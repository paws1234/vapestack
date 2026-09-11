import type { ButtonHTMLAttributes } from "react";

/** Visual weight of a button. */
type Variant = "primary" | "outline" | "ghost";

/** Button height and padding. */
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANTS: Record<Variant, string> = {
  primary: "border border-transparent bg-neon-400 text-ink-950 hover:bg-neon-300",
  /*
    `border-line`, not `border-ink-700`: measured at 1.25:1, the old border made an outline button
    all but invisible on the dark page, and an outline button is identified by nothing else. See
    `frontend/UI-STANDARDS.md`.
  */
  outline: "border border-line text-ink-50 hover:border-neon-400 hover:text-neon-400",
  ghost: "border border-transparent text-ink-200 hover:text-ink-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

/**
 * Class list that makes anything look like a button.
 *
 * Exported so links can be styled identically without the component having to render an
 * anchor, which would mean forwarding href, target and rel by hand.
 *
 * @param variant Visual weight.
 * @param size    Height and padding.
 */
export function buttonStyles(variant: Variant = "primary", size: Size = "md"): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
  ].join(" ");
}

/**
 * A button in the storefront's own style.
 *
 * @param props Standard button attributes, plus variant and size.
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return <button className={`${buttonStyles(variant, size)} ${className}`} {...props} />;
}
