/**
 * The cart's hold, as arithmetic.
 *
 * Pure and framework-free on purpose, like `variations.ts`: the store needs the duration, a
 * client hook needs the state, and neither should have to import the other. Nothing in here
 * reads a clock of its own — `now` is a parameter everywhere, so the same inputs always give the
 * same answer and a ticking component can be reasoned about without one.
 *
 * The hold is a **simulation of a reservation**. Nothing is taken out of any stock pool when a
 * line goes in, so nothing is returned to one when the clock runs out, and the copy that uses
 * this says so.
 */

/** How long a cart holds its lines. */
export const HOLD_MS = 10 * 60 * 1000;

/**
 * When a hold started now would run out.
 *
 * @param now Current time, from `Date.now()` at the call site.
 */
export function holdDeadline(now: number): number {
  return now + HOLD_MS;
}

/**
 * Remaining time in `mm:ss`, rounded **up** so a fresh hold reads `10:00` rather than `09:59`
 * and the last second is not spent showing zero.
 *
 * @param ms Remaining milliseconds, possibly negative once the hold has passed.
 */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${rest}`;
}

/**
 * What the drawer has to say about the hold.
 *
 * `none` covers two situations that render identically — there is no hold, and there is no clock
 * yet because the server is rendering or the drawer is shut. Both mean "show nothing", and
 * collapsing them is what keeps the countdown out of the served HTML.
 */
export type HoldState =
  | { status: "none" }
  | { status: "counting"; remainingMs: number; label: string }
  | { status: "expired" };

/**
 * Reads the hold.
 *
 * @param expiresAt When the hold runs out, or null when there is no hold.
 * @param now       Current time. Zero or below means no clock is running, which is the server's
 *                  answer and the drawer's while it is closed.
 */
export function readHold(expiresAt: number | null, now: number): HoldState {
  if (expiresAt === null || now <= 0) {
    return { status: "none" };
  }

  const remaining = expiresAt - now;

  if (remaining <= 0) {
    return { status: "expired" };
  }

  return { status: "counting", remainingMs: remaining, label: formatCountdown(remaining) };
}
