"use client";

import { buttonStyles } from "@/components/ui/button";
import { cartCount, useCartStore } from "@/stores/cart";

/**
 * Opens the drawer, and says how much is in it.
 *
 * A client component because the count lives in the browser's storage. It shares the store with
 * the drawer through the module, so nothing has to wrap the layout in a provider.
 *
 * The visible word is always "Cart"; the count is in the accessible name instead, so a screen
 * reader hears "Cart, 2 items" rather than "Cart 2".
 */
export function CartButton() {
  const items = useCartStore((state) => state.items);
  const open = useCartStore((state) => state.open);
  const count = cartCount(items);

  return (
    <button
      type="button"
      onClick={open}
      className={buttonStyles("outline", "sm")}
      aria-label={0 === count ? "Cart, empty" : `Cart, ${count} ${1 === count ? "item" : "items"}`}
    >
      Cart
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neon-400 px-1.5 text-xs font-semibold text-ink-950"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
