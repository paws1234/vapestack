"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CartHoldBanner } from "@/components/cart/cart-hold-banner";
import { CartLine } from "@/components/cart/cart-line";
import { RewardProgress } from "@/components/cart/reward-progress";
import { Button, buttonStyles } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { useModalBehaviour } from "@/lib/modal-behaviour";
import { useLiveHold } from "@/lib/use-live-hold";
import { cartSubtotal, useCartStore } from "@/stores/cart";

/**
 * The cart, as a slide-over.
 *
 * Mounted by the root layout rather than by the header, for two reasons. It has to sit outside
 * `<header>`: that element is `backdrop-blur`, and a `backdrop-filter` makes it the containing
 * block for `position: fixed` descendants, so a fixed overlay inside it would be positioned
 * against the header box instead of the viewport. And it stays mounted while closed, so the
 * slide transition runs in both directions - which is why it carries `inert` when hidden.
 *
 * The checkout button leads to `/checkout`, which is where the cart becomes a real order; the
 * link closes the drawer on its way, the same as the empty state's shop link.
 */
export function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const expiresAt = useCartStore((state) => state.expiresAt);
  const isOpen = useCartStore((state) => state.isOpen);
  const close = useCartStore((state) => state.close);
  const extendHold = useCartStore((state) => state.extendHold);
  const panelRef = useRef<HTMLDivElement>(null);

  /*
    The one place the persisted cart is read back. `skipHydration` keeps storage out of the
    first render so it matches the prerendered HTML; this puts the saved lines in immediately
    afterwards, which is also why it must live in a component the layout always mounts.
  */
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  useModalBehaviour({ open: isOpen, panelRef, onEscape: close });

  const subtotal = cartSubtotal(items);
  const isEmpty = 0 === items.length;

  /*
    The clock runs only while the drawer is open with lines in it. The hold is a stored deadline,
    so a closed drawer loses nothing by not watching it - reopening reads the deadline again and
    shows the truth immediately, expired included.
  */
  const hold = useLiveHold(expiresAt, isOpen && !isEmpty);
  const holdExpired = "expired" === hold.status;

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
      {/* Clicking the dimmed page behind the drawer closes it; Escape and the Close button are the keyboard routes. */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
        inert={!isOpen}
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-ink-800 bg-ink-900 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-ink-800 px-5 py-4">
          <h2 id="cart-drawer-title" className="text-lg font-semibold text-ink-50">
            Your cart
          </h2>

          <Button variant="ghost" size="sm" onClick={close} aria-label="Close cart">
            Close
          </Button>
        </div>

        {isEmpty || "none" === hold.status ? null : (
          <div className="px-5 pt-4">
            <CartHoldBanner hold={hold} onExtend={extendHold} />
          </div>
        )}

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
            <p className="text-ink-400">Nothing in the cart yet.</p>
            <Link href="/shop" onClick={close} className={buttonStyles("primary", "sm")}>
              Browse the shop
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-ink-800 overflow-y-auto px-5">
              {items.map((line) => (
                <CartLine key={line.key} line={line} />
              ))}
            </ul>

            <div className="space-y-3 border-t border-ink-800 px-5 py-5">
                <RewardProgress subtotal={subtotal} />

                <div className="flex items-center justify-between gap-4 border-t border-ink-800 pt-3">
                <span className="text-sm text-ink-400">Subtotal</span>
                <Price min={subtotal} max={subtotal} className="text-lg font-semibold text-neon-400" />
              </div>

              <p className="text-xs text-ink-400">
                A demo shop: nothing is charged and nothing ships. WooCommerce prices the order
                that is created, not this total.
              </p>

                {/*
                Not offered while the hold has run out. The banner above says why and carries the
                one action that changes it, so the space where the button was explains itself
                rather than simply going blank.
              */}
                {holdExpired ? (
                  <p className="text-xs text-ink-400">
                    Extend the hold above to check out. Your lines are still here, and nothing has
                    been charged.
                  </p>
                ) : (
                    <Link
                      href="/checkout"
                      onClick={close}
                      className={`${buttonStyles("primary", "md")} w-full`}
                    >
                      Checkout
                    </Link>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
