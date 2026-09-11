/**
 * The first focusable thing in the document, invisible until it is focused.
 *
 * It points at `#main-content`, which the root layout puts on `<main>` along with `tabIndex={-1}`
 * — without the tab index the page would scroll and focus would stay on the link, which is the
 * half-fix that makes skip links feel broken.
 *
 * Above the sticky header (`z-40`) and the overlays (`z-50`, `z-[60]`), because it is only ever
 * visible while focused and must not be covered when it is.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className={[
        "sr-only",
        "focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70]",
        "focus:rounded-full focus:bg-neon-400 focus:px-4 focus:py-2",
        "focus:text-sm focus:font-medium focus:text-ink-950",
      ].join(" ")}
    >
      Skip to content
    </a>
  );
}
