/**
 * The demo-mode receipt, kept in the browser tab that placed it.
 *
 * When WordPress cannot be reached, WooCommerce cannot create an order either. Rather than fail the
 * checkout, the form stashes the summary it would have been shown and sends the visitor to
 * `/checkout/success/demo`, which reads it back from here.
 *
 * `sessionStorage` on purpose: this is a receipt for one tab, not a record worth keeping, and it is
 * cleared when the tab closes. Nothing in it is trusted by anything - it only ever feeds the page
 * that displays it, and no price in it reaches WooCommerce.
 */

/** Where the demo receipt lives. */
export const DEMO_ORDER_KEY = "vapestack-demo-order";

/** One line of the demo receipt, mirroring what an order summary would carry. */
export type DemoOrderLine = {
  name: string;
  /** Chosen option labels, e.g. `Frost Mint`, `6mg`. */
  options: string[];
  quantity: number;
  total: number;
};

/** What the checkout shows when WordPress was unreachable. */
export type DemoOrder = {
  items: DemoOrderLine[];
  total: number;
};

/**
 * Stores a demo receipt.
 *
 * @param order Summary to keep for the tab.
 */
export function writeDemoOrder(order: DemoOrder): void {
  try {
    window.sessionStorage.setItem(DEMO_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* Storage can be refused; the success page already handles finding nothing. */
  }
}

/**
 * Reads the stored receipt back.
 *
 * Returns the raw string rather than a parsed object so it can be used as a
 * `useSyncExternalStore` snapshot, where a fresh object on every call would loop forever.
 */
export function readDemoOrderRaw(): string | null {
  try {
    return window.sessionStorage.getItem(DEMO_ORDER_KEY);
  } catch {
    return null;
  }
}

/**
 * Parses a stored receipt, ignoring anything that is not one.
 *
 * @param raw Value as stored, or null.
 */
export function parseDemoOrder(raw: string | null): DemoOrder | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DemoOrder;

    return Array.isArray(parsed?.items) && "number" === typeof parsed.total ? parsed : null;
  } catch {
    return null;
  }
}
