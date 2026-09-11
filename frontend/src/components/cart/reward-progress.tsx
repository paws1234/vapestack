"use client";

import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { REWARD_TIERS, rewardProgress } from "@/lib/cart-rewards";

/**
 * How far the cart is from the next rung of the spend ladder.
 *
 * A pure function of the subtotal: the drawer passes `cartSubtotal(items)` and nothing here holds
 * state. The progress a visitor sees is derived on every render, which is why there is no way for
 * the bar and the message to disagree.
 *
 * The claim and the honest sentence under it are deliberately in the same block, the way the
 * footer and the checkout already do it. Nothing this shop can unlock is real — it takes no
 * payment and ships nothing — so the block carries a `Simulation` label and says so in words
 * rather than relying on the pill to do the work.
 *
 * The message is the live region, not the bar: the bar changes on every cent and would announce
 * continuously, while the message only changes when a rung is reached. The bar itself is a real
 * `role="progressbar"` with its bounds set, so assistive technology gets the numbers as well.
 *
 * @param props.subtotal Cart subtotal, from `cartSubtotal(items)`.
 */
export function RewardProgress({ subtotal }: { subtotal: number }) {
  const progress = rewardProgress(subtotal);

  return (
    <div data-tiers-reached={progress.reached} className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.25em] text-ink-400">Spend ladder</span>
        <Badge tone="muted">Simulation</Badge>
      </div>

      {/*
        The track uses `--color-line` rather than a decorative token: the extent of the bar is the
        information, so it has to be perceivable, and ink-800 against ink-900 is 1.06:1.
      */}
      <div
        role="progressbar"
        aria-label="Spend ladder progress in US dollars"
        aria-valuemin={0}
        aria-valuemax={progress.ceiling}
        aria-valuenow={progress.value}
        className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-neon-400 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${Math.round(progress.fraction * 100)}%` }}
        />
      </div>

      {/*
        The message is not the live region. It changes on every quantity tweak — the amount
        remaining moves with the subtotal — and announcing that is noise. What is worth
        announcing is reaching a rung, and only that, so it goes in a separate `role="status"`
        element whose text only changes when the number of rungs reached does. Text that does not
        change is not re-announced, which is what makes "once per crossing" fall out of the shape
        rather than out of a timer or a remembered previous value.
      */}
      <p className="text-sm text-ink-200">
        {progress.next ? (
          <>
            Add <Price min={progress.remaining} max={progress.remaining} /> more to unlock{" "}
            {progress.next.label.toLowerCase()}.
          </>
        ) : (
          <>Every tier reached — free express shipping and a free lanyard.</>
        )}
      </p>

      <div role="status" aria-live="polite" className="sr-only">
        {0 === progress.reached
          ? ""
          : `${REWARD_TIERS[progress.reached - 1].label} unlocked.`}
      </div>

      <p className="text-xs leading-relaxed text-ink-400">
        Nothing is really unlocked: this is a demonstration of a spend ladder, and the shop takes
        no payment and ships nothing.
      </p>
    </div>
  );
}
