"use client";

import { Button } from "@/components/ui/button";
import type { HoldState } from "@/lib/cart-hold";

/** Shared surface for both states, so the drawer's hold always occupies the same shape. */
const PANEL = "rounded-2xl border border-line bg-ink-950/60 px-4 py-3";

/**
 * How long the cart is holding its lines, or that it has stopped.
 *
 * Presentational: the clock lives in `lib/use-live-hold.ts` and the drawer owns it, so this
 * renders one of two things and nothing more.
 *
 * The countdown is deliberately **not** a live region. A number that changes every second is
 * noise to a screen reader, and the states this actually has — running, and run out — are one
 * transition each. That transition is announced instead, through a `role="status"` element that
 * is already in the DOM while the hold is merely counting, which is what makes the change to
 * "run out" announce rather than mount silently.
 *
 * @param props.hold     State read from the deadline by the drawer.
 * @param props.onExtend Starts a fresh hold.
 */
export function CartHoldBanner({ hold, onExtend }: { hold: HoldState; onExtend: () => void }) {
  if ("none" === hold.status) {
    return null;
  }

  return (
    <>
      {/* Mounted for the whole life of the hold, so the expiry is a change inside a live region
          rather than a new element appearing with no announcement. */}
      <div role="status" aria-live="polite" className="sr-only">
        {"expired" === hold.status ? "The cart hold has run out." : ""}
      </div>

      {"counting" === hold.status ? (
        <div data-cart-hold="counting" className={PANEL}>
          <p className="text-sm font-medium text-ink-50">
            Held for{" "}
            {/* Tabular figures, or the countdown jitters as the digits change width. */}
            <span className="tabular-nums">{hold.label}</span>
          </p>

          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            A simulation of a reservation, kept in this browser. Nothing is really held back, and
            no stock has been taken out of anything.
          </p>
        </div>
      ) : (
        <div data-cart-hold="expired" className={PANEL}>
          <p className="text-sm font-medium text-ink-50">The hold has run out</p>

          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Your lines are still here. Nothing went back into stock, because nothing came out of
            it — the hold is a simulation of a reservation and this one has simply finished.
          </p>

          <Button type="button" variant="outline" size="sm" onClick={onExtend} className="mt-3">
            Hold for another 10 minutes
          </Button>
        </div>
      )}
    </>
  );
}
