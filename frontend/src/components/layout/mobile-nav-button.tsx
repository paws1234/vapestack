"use client";

import { useCartStore } from "@/stores/cart";
import { useNavStore } from "@/stores/nav";

/** The menu mark, drawn inline so no icon dependency is needed. */
function MenuIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  );
}

/**
 * The header's menu trigger, below `md` only.
 *
 * `md:hidden` rather than `hidden`: Tailwind v4 emits `.hidden` before the display utilities, so an
 * unprefixed `hidden` loses to whichever one is emitted later. Variants are emitted after the base
 * utilities, so a variant is the reliable way to hide something. See `frontend/UI-STANDARDS.md`.
 *
 * Opening it closes the cart drawer. Both panels cover the whole screen, and a drawer left open
 * underneath would be a scroll lock with nothing visible to explain it.
 */
export function MobileNavButton() {
  const isOpen = useNavStore((state) => state.isOpen);

  return (
    <button
      type="button"
      onClick={() => {
        useCartStore.getState().close();
        useNavStore.getState().open();
      }}
      aria-label="Open menu"
      aria-expanded={isOpen}
      aria-controls="mobile-nav"
      className={[
        "md:hidden",
        "inline-flex size-9 items-center justify-center rounded-full",
        "border border-line text-ink-50 transition hover:border-neon-400 hover:text-neon-400",
      ].join(" ")}
    >
      <MenuIcon />
    </button>
  );
}
