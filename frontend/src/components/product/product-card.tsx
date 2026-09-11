import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import type { Product } from "@/lib/wp/types";

/**
 * One product in a grid.
 *
 * The card is a single focus target: the link is the only focusable element inside it, so Tab
 * lands on the card exactly once and the rule in `globals.css` draws one ring around the whole
 * thing. Anything that would add a second stop (a quick-add button, a wishlist toggle) is
 * deliberately absent — the card names the product, and the product page is where the decision
 * is made.
 *
 * Hover and focus are different states on purpose: hover changes the border, focus draws the
 * outline, so a keyboard user can tell focus from "the pointer happens to be here".
 *
 * @param props.product Product to render.
 * @param props.eager   Load the image immediately. Set it for cards in the first row: they are
 *                      the largest thing on the page, and lazy loading them delays LCP.
 */
export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const soldOut = product.stockStatus === "out-of-stock";

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-900 transition hover:border-neon-400/60"
    >
      <div className="relative aspect-square bg-ink-800">
        {product.image ? (
          <Image
            src={product.image.url}
            /* Decorative, and confirmed against `UI-STANDARDS.md`: the `<h3>` in this same link
               already names the product, so alt text here would make a screen reader announce a
               better-labelled duplicate of the link it is already inside. Do not add one. */
            alt=""
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 motion-reduce:duration-0 motion-safe:group-hover:scale-105"
          />
        ) : null}

        {/*
          The badge sits on a photograph, so it uses the `overlay` tone: a near-solid surface the
          picture cannot show through. The card still links — a sold-out product is reachable on
          purpose, because its page is where the reason and the alternatives live. Sold-out is not
          disabled.
        */}
        {soldOut ? (
          <span className="absolute left-3 top-3">
            <Badge tone="overlay">Sold out</Badge>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category ? (
          <span className="text-xs uppercase tracking-[0.25em] text-ink-400">
            {product.category.name}
          </span>
        ) : null}

        <h3 className="text-base font-medium text-ink-50">{product.name}</h3>

        {/* Wraps rather than clips: at 390px a range price and an option count do not fit on one
            line, and a clipped price is worse than a second line. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3">
          <Price
            min={product.price.min}
            max={product.price.max}
            className="font-semibold text-neon-400"
          />
          {product.variations.length > 0 ? (
            <span className="text-xs text-ink-400">
              {product.variations.length} {product.variations.length === 1 ? "option" : "options"}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
