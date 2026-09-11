import type { ReactNode } from "react";

/**
 * Body copy that was authored as plain HTML — the info and legal pages.
 *
 * Written as Tailwind child variants rather than a `.prose` rule in `globals.css`, because a CSS
 * rule here would run straight into the trap this project has already paid for: an unlayered rule
 * beats every layer, and a layered one loses to the utilities. Keeping the styling on the element
 * means there is no layer question to get wrong, and no second place to look when a heading looks
 * off. No `@tailwindcss/typography`, either — the project adds no dependencies for this.
 *
 * The markup it wraps is deliberately unclassed, so the pages read like the content they are.
 */
const PROSE_CLASSES = [
  "leading-relaxed text-ink-200",
  // Vertical rhythm between blocks, without needing a class on every one.
  "[&>*+*]:mt-4",
  "[&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink-50",
  "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-ink-50",
  "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6",
  "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6",
  "[&_a]:text-neon-400 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-neon-300",
  "[&_strong]:font-medium [&_strong]:text-ink-50",
].join(" ");

/**
 * Wraps authored body copy in the storefront's type.
 *
 * @param props.children Markup with no classes of its own.
 */
export function Prose({ children }: { children: ReactNode }) {
  return <div className={PROSE_CLASSES}>{children}</div>;
}
