import type { ReactNode } from "react";

/** How loud the badge is. */
type Tone = "neutral" | "accent" | "muted" | "overlay";

const TONES: Record<Tone, string> = {
  neutral: "border-ink-700 bg-ink-800 text-ink-200",
  accent: "border-neon-400/40 bg-neon-400/10 text-neon-400",
  muted: "border-ink-700 bg-ink-900/80 text-ink-400",
  /*
    For a badge that sits on top of a photograph, where the page colour underneath is unknown.
    `muted` is fine on a flat panel — ink-400 on ink-900 is 5.24:1 — but over a product image its
    80%-opaque fill lets the picture through and the label is whatever the picture happens to be.
    This tone lays down a near-solid ink-950 surface first, which puts the label back at 18.66:1
    whatever is behind it, and draws its boundary with `--color-line` rather than the decorative
    `ink-700`.
  */
  overlay: "border-line bg-ink-950/90 text-ink-50",
};

/**
 * A small pill for stock state, category and other one-line labels.
 *
 * @param props.tone   How loud the badge is, and whether it sits on a photograph (`overlay`).
 * @param props.children Label text.
 */
export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
