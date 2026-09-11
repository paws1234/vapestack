/**
 * The post-purchase timeline, as data and storage.
 *
 * Pure and framework-free apart from the storage helpers, like `cart-hold.ts`: the stages and the
 * mapping from a WooCommerce status to a starting stage are values and functions, and the stage a
 * reviewer has reached is one small key in `localStorage`.
 *
 * **The stage is keyed by order id**, so two orders never share one, and a real order and the demo
 * receipt are separate timelines. Nothing here writes to WordPress: the order's own status is read
 * once to decide where the timeline starts, and is never updated.
 *
 * The whole feature is a demonstration. Nothing ships from this shop, so there is no courier to
 * name, no tracking number to invent and no arrival date to promise - the copy the component builds
 * from these stages says so, and the stages are worded as things a shop that shipped could say
 * rather than things this one does.
 */

/** One stage of the four. */
export type TimelineStage = {
  /** Stable id, used as the React key. */
  id: string;
  /** What the stage is called on the page. */
  label: string;
  /** One line saying what it would mean in a shop that really dispatched anything. */
  note: string;
};

/**
 * The four stages, in order.
 *
 * Deliberately `confirmed → quality check → dispatched → out for delivery`: it is the shape the
 * plan's origin describes, and each stage is something a real shop could observe about a parcel.
 */
export const TIMELINE_STAGES: readonly TimelineStage[] = [
  {
    id: "confirmed",
    label: "Order confirmed",
    note: "The shop accepted the order and would be getting it ready.",
  },
  {
    id: "quality-check",
    label: "Quality check",
    note: "The order would be checked and packed before it left.",
  },
  {
    id: "dispatched",
    label: "Dispatched",
    note: "The parcel would have left the building.",
  },
  {
    id: "out-for-delivery",
    label: "Out for delivery",
    note: "A courier would have it and be on the way.",
  },
];

/** The last stage, which is where the reviewer control stops. */
export const LAST_STAGE = TIMELINE_STAGES.length - 1;

/**
 * Where a stage is kept, per order.
 *
 * @param orderId A WooCommerce order id, or `demo` for the receipt that has none.
 */
export function timelineKey(orderId: string | number): string {
  return `vapestack-timeline:${orderId}`;
}

/**
 * Rounds a stage index into the range the timeline has.
 *
 * @param index Anything that came out of storage, which may be nonsense.
 */
export function clampStage(index: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(index), 0), LAST_STAGE);
}

/**
 * The stage a real order starts at, from its own WooCommerce status.
 *
 * The point is that the timeline begins from something true rather than from zero: an order on hold
 * has not been confirmed the same way a processing one has, and a completed one has finished the
 * demonstration.
 *
 * @param status WooCommerce status slug, e.g. `processing`.
 */
export function startingStage(status: string): number {
  switch (status) {
    case "completed":
      return LAST_STAGE;
    case "on-hold":
    case "pending":
      return 1;
    default:
      /* `processing` and anything unrecognised: the order exists and was accepted. */
      return 0;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Storage
 * ---------------------------------------------------------------------------------------------- */

/** The browser's own record of who is watching this timeline. */
let listeners: (() => void)[] = [];

/**
 * Subscribes to stage changes.
 *
 * Module scope so `useSyncExternalStore` gets an identity that holds still across renders.
 *
 * @param onChange Called after any stage is written.
 */
export function subscribeToTimeline(onChange: () => void): () => void {
  listeners = [...listeners, onChange];

  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
}

/**
 * Reads an order's stage as stored.
 *
 * Returns the raw string rather than a number so it can be a `useSyncExternalStore` snapshot: a
 * primitive that only changes when the value does, rather than a fresh object on every call.
 *
 * @param orderId A WooCommerce order id, or `demo`.
 */
export function readStageRaw(orderId: string | number): string | null {
  try {
    return window.localStorage.getItem(timelineKey(orderId));
  } catch {
    /* Storage can be refused; a timeline that does not remember is better than a broken page. */
    return null;
  }
}

/**
 * Stores an order's stage and tells the subscribers.
 *
 * @param orderId A WooCommerce order id, or `demo`.
 * @param stage   Stage index to keep.
 */
export function writeStage(orderId: string | number, stage: number): void {
  try {
    window.localStorage.setItem(timelineKey(orderId), String(clampStage(stage)));
  } catch {
    /* Nothing to do: the caller's own state still shows the stage for this visit. */
  }

  for (const listener of listeners) {
    listener();
  }
}

/**
 * The server cannot read storage, so its answer is always "nothing recorded".
 *
 * Passed to `useSyncExternalStore` as the server snapshot, which React also uses for the hydration
 * render - so the served HTML and the first client render agree on the starting stage whatever the
 * browser is holding.
 */
export function noStoredStage(): null {
  return null;
}
