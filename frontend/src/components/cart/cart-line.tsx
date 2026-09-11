"use client";

import Image from "next/image";
import Link from "next/link";
import { Price } from "@/components/ui/price";
import { MAX_QUANTITY, useCartStore, type CartItem } from "@/stores/cart";

/** How one quantity button looks, disabled state included. */
const STEP_CLASSES = [
  "inline-flex size-7 items-center justify-center rounded-full border border-line",
  "text-ink-200 transition hover:border-neon-400 hover:text-neon-400",
  "disabled:cursor-not-allowed disabled:opacity-40",
  "disabled:hover:border-line disabled:hover:text-ink-200",
].join(" ");

/**
 * One line of the cart: what it is, how many, and the controls that change that.
 *
 * The unit price only appears once the quantity is more than one - at one, it would repeat the
 * line total standing next to it.
 *
 * @param props.line The line to render.
 */
export function CartLine({ line }: { line: CartItem }) {
  const remove = useCartStore((state) => state.remove);
  const setQuantity = useCartStore((state) => state.setQuantity);

  const lineTotal = line.unitPrice * line.quantity;

  return (
    <li className="flex gap-4 py-5">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-ink-800 bg-ink-950">
        {line.image ? (
          <Image
            src={line.image.url}
            alt={line.image.alt}
            fill
            sizes="80px"
            className="object-contain"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/product/${line.slug}`}
              className="font-medium text-ink-50 transition hover:text-neon-400"
            >
              {line.name}
            </Link>

            {line.options.length > 0 ? (
              <p className="truncate text-sm text-ink-400">{line.options.join(" · ")}</p>
            ) : null}

            {line.quantity > 1 ? (
              <p className="mt-1 text-sm text-ink-400">
                <Price min={line.unitPrice} max={line.unitPrice} /> each
              </p>
            ) : null}
          </div>

          <Price min={lineTotal} max={lineTotal} className="shrink-0 font-medium text-ink-50" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity(line.key, line.quantity - 1)}
              disabled={line.quantity <= 1}
              aria-label={`Decrease quantity of ${line.name}`}
              className={STEP_CLASSES}
            >
              <span aria-hidden="true">−</span>
            </button>

            {/* Announced, because the buttons beside it are labelled by what they do, not by the count. */}
            <span aria-live="polite" className="w-6 text-center text-sm text-ink-50">
              {line.quantity}
            </span>

            <button
              type="button"
              onClick={() => setQuantity(line.key, line.quantity + 1)}
              disabled={line.quantity >= MAX_QUANTITY}
              aria-label={`Increase quantity of ${line.name}`}
              className={STEP_CLASSES}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => remove(line.key)}
            className="text-sm text-ink-400 underline-offset-4 transition hover:text-neon-400 hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
