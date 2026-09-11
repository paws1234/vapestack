"use client";

import { useSyncExternalStore } from "react";
import { readHold, type HoldState } from "@/lib/cart-hold";

/**
 * The clock the cart's hold counts against.
 *
 * One module-scope interval for the whole app rather than one per component, started when the
 * first subscriber arrives and cleared when the last one leaves. Nothing ticks while the drawer
 * is shut: the state is derived from a stored deadline, so the next time anybody looks it is
 * already correct without having been watched in between.
 *
 * `getServerSnapshot` is what keeps hydration quiet. React uses it for the server render *and*
 * for the hydration render, so the served HTML and the first client render agree on "no clock,
 * no hold to show" whatever `clock` happens to be — which is also why `clock` may be
 * initialised with the real time without a mismatch.
 */

/** How often the clock is re-read. The display is `mm:ss`, so a second is exact enough. */
const TICK_MS = 1000;

let listeners: (() => void)[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

/** The current time as React last read it. */
let clock = Date.now();

function tick(): void {
  /* Recomputed from the real clock rather than by adding a second, so a tab the browser has
     throttled catches up instead of drifting behind. */
  clock = Date.now();

  for (const listener of listeners) {
    listener();
  }
}

function subscribeToClock(onChange: () => void): () => void {
  listeners = [...listeners, onChange];
  clock = Date.now();

  if (timer === null) {
    timer = setInterval(tick, TICK_MS);
  }

  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);

    if (listeners.length === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** For a hold that is not being looked at: no interval, no re-renders. */
function subscribeToNothing(): () => void {
  return () => {};
}

function readClock(): number {
  return clock;
}

/** The server has no clock, and zero is what `readHold` reads as "nothing to show". */
function readNoClock(): number {
  return 0;
}

/**
 * Watches the cart's hold while it is worth watching.
 *
 * @param expiresAt When the hold runs out, or null when there is none.
 * @param active    Whether to run the clock at all — the drawer passes "open, with lines in it".
 *                  Entries and the subscribe function are both selected from it, and both are
 *                  module-scope constants, so React re-subscribes on the way in and out.
 */
export function useLiveHold(expiresAt: number | null, active: boolean): HoldState {
  const now = useSyncExternalStore(
    active ? subscribeToClock : subscribeToNothing,
    active ? readClock : readNoClock,
    readNoClock,
  );

  return readHold(expiresAt, now);
}
