/**
 * The cart's spend ladder, as arithmetic.
 *
 * Pure and framework-free, like `cart-hold.ts`: it takes a number and returns what the drawer
 * should say, so the same subtotal always gives the same answer and nothing here needs a clock,
 * a store or a component.
 *
 * The tiers are **a simulation of a spend ladder**. This shop takes no payment, so it ships
 * nothing and gives nothing away; the copy built from these labels says so, and the labels
 * themselves are worded as things a shop could promise rather than things this one does.
 */

/** One rung of the ladder. */
export type RewardTier = {
  /** Subtotal, in dollars, that reaches this tier. */
  threshold: number;
  /** What reaching it is called. Sentence case; the copy lowercases it mid-sentence. */
  label: string;
};

/**
 * The ladder, cheapest rung first.
 *
 * $25 and $50 sit either side of a realistic basket here: one e-liquid lands under the first
 * rung, two pod kits go straight past the second.
 */
export const REWARD_TIERS: readonly RewardTier[] = [
  { threshold: 25, label: "Free express shipping" },
  { threshold: 50, label: "A free lanyard" },
];

/** Where the cart stands on the ladder. */
export type RewardProgress = {
  /** Top of the ladder, which is what the bar is measured against. */
  ceiling: number;
  /** How many tiers the subtotal has reached. */
  reached: number;
  /** The next tier, or null once the whole ladder is behind the cart. */
  next: RewardTier | null;
  /** How much more to spend for `next`, to the cent. Zero when there is no next tier. */
  remaining: number;
  /** Subtotal capped at the ceiling: the value the bar reports. */
  value: number;
  /** 0 to 1, for the bar's width. */
  fraction: number;
};

/**
 * Rounds to cents.
 *
 * `cartSubtotal` is exact to the cent but subtraction is not, and "$11.030000000000001" is not a
 * thing to put on a button.
 *
 * @param value Amount in dollars.
 */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Where the cart stands.
 *
 * @param subtotal Cart subtotal, already rounded to cents by `cartSubtotal`.
 */
export function rewardProgress(subtotal: number): RewardProgress {
  const ceiling = REWARD_TIERS.at(-1)?.threshold ?? 0;
  const reached = REWARD_TIERS.filter((tier) => subtotal >= tier.threshold).length;
  const next = REWARD_TIERS[reached] ?? null;
  const value = Math.min(subtotal, ceiling);

  return {
    ceiling,
    reached,
    next,
    remaining: next ? toCents(next.threshold - subtotal) : 0,
    value,
    fraction: ceiling > 0 ? value / ceiling : 1,
  };
}
