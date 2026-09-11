import type { ReactNode } from "react";

/** How loud the badge is. */
type Tone = "neutral" | "accent" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "border-ink-700 bg-ink-800 text-ink-200",
  accent: "border-neon-400/40 bg-neon-400/10 text-neon-400",
  muted: "border-ink-700 bg-ink-900/80 text-ink-400",
};

/**
 * A small pill for stock state, category and other one-line labels.
 *
 * @param props.tone   How loud the badge is.
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
