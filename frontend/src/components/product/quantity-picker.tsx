"use client";

import { MAX_QUANTITY, clampQuantity } from "@/stores/cart";

/** How one step button looks, disabled state included. Matches the cart line's stepper. */
const STEP_CLASSES = [
  "inline-flex size-9 items-center justify-center rounded-full border border-line",
  "text-ink-200 transition hover:border-neon-400 hover:text-neon-400",
  "disabled:cursor-not-allowed disabled:opacity-40",
  "disabled:hover:border-line disabled:hover:text-ink-200",
].join(" ");

/**
 * How many of a product to add, as a stepper rather than a free-text number field.
 *
 * A stepper cannot produce a value the shop will not accept, so there is no out-of-range state to
 * reject: both buttons do their arithmetic through `clampQuantity`, and each is disabled at the
 * end it would leave. The same bounds the cart line uses, from the same place, so the two can
 * never disagree about what `MAX_QUANTITY` is.
 *
 * @param props.value      Current quantity.
 * @param props.onChange   Called with the new quantity, already clamped.
 * @param props.productName Product the quantity refers to, so the buttons are not all "Increase".
 */
export function QuantityPicker({
  value,
  onChange,
  productName,
}: {
  value: number;
  onChange: (quantity: number) => void;
  productName: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-ink-400">Quantity</span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clampQuantity(value - 1))}
          disabled={value <= 1}
          aria-label={`Decrease quantity of ${productName}`}
          className={STEP_CLASSES}
        >
          <span aria-hidden="true">−</span>
        </button>

        {/* Announced, because the buttons beside it are named by what they do, not by the count. */}
        <span aria-live="polite" className="w-8 text-center text-ink-50">
          {value}
        </span>

        <button
          type="button"
          onClick={() => onChange(clampQuantity(value + 1))}
          disabled={value >= MAX_QUANTITY}
          aria-label={`Increase quantity of ${productName}`}
          className={STEP_CLASSES}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}
