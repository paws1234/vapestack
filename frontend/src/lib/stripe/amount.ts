/**
 * Money, in the unit Stripe counts in.
 *
 * WooCommerce prices an order and hands back a decimal string; Stripe wants a whole number of the
 * currency's smallest unit. That conversion is the one place in this app where a rounding mistake
 * would be a money mistake, so it is a function with a currency check rather than an expression
 * buried in a route.
 *
 * Pure and framework-free, like `cart-hold.ts` and `cart-rewards.ts`.
 */

/**
 * How many decimal places each currency this shop can price has.
 *
 * A lookup rather than arithmetic on a guess: a currency that is not here is refused, because
 * treating an unknown one as two-decimal would charge a hundredth or a hundred times the price of
 * some of them. The shop is set to USD; a second entry is a decision, not a typo.
 */
const DECIMAL_PLACES: Record<string, number> = { usd: 2 };

/**
 * Converts a WooCommerce total into the smallest unit of its currency.
 *
 * @param total    Total as WooCommerce sends it, e.g. `"29.98"`.
 * @param currency ISO code as WooCommerce sends it, e.g. `"usd"`.
 * @throws Error when the currency is unknown, or the total is not an amount that can be charged.
 */
export function toMinorUnits(total: string, currency: string): number {
  const code = currency.trim().toLowerCase();
  const places = DECIMAL_PLACES[code];

  if (undefined === places) {
    throw new Error(`No minor unit is known for "${currency}", so the amount cannot be charged.`);
  }

  const value = Number(total);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`WooCommerce priced the order at "${total}", which is not an amount to charge.`);
  }

  /* Rounded, not truncated: 29.98 * 100 is 2997.9999999999996 in binary floating point. */
  return Math.round(value * 10 ** places);
}
