"use client";

import { useCartStore } from "@/stores/cart";
import { useNavStore } from "@/stores/nav";
import { useSearchStore } from "@/stores/search";

/** The magnifier, drawn inline so no icon dependency is needed. */
function SearchIcon() {
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
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2L17 17" />
    </svg>
  );
}

/**
 * The header's search trigger.
 *
 * Icon-only, because a phone's header is wordmark plus three controls and the meaning is carried by
 * the accessible name — which also names the shortcut, so a screen reader announces "Search the
 * shop, Command or Control K" rather than an unlabelled glyph. `aria-keyshortcuts` is the
 * machine-readable half of the same fact.
 *
 * Opening search closes the nav and the cart drawer, and both of those close search in turn: all
 * three cover the screen, and two open at once would be a scroll lock with nothing to explain it.
 */
export function SearchButton() {
  const isOpen = useSearchStore((state) => state.isOpen);

  return (
    <button
      type="button"
      onClick={() => {
        useNavStore.getState().close();
        useCartStore.getState().close();
        useSearchStore.getState().open();
      }}
      aria-label="Search the shop (Command or Control K)"
      aria-keyshortcuts="Control+K Meta+K"
      aria-expanded={isOpen}
      aria-controls="search-dialog"
      className="inline-flex size-9 items-center justify-center rounded-full border border-line text-ink-50 transition hover:border-neon-400 hover:text-neon-400"
    >
      <SearchIcon />
    </button>
  );
}
