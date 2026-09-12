"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { PhotoTile } from "@/components/product/photo-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { QuantityPicker } from "@/components/product/quantity-picker";
import { useCartStore } from "@/stores/cart";
import type { Product } from "@/lib/wp/types";
import {
  chosenOptionLabels,
  findVariation,
  initialSelection,
  isOptionAvailable,
  unavailableMessage,
  type Selection,
} from "@/lib/variations";

/**
 * Class list for one option pill.
 *
 * Four states rather than two: a combination can be sold out while its neighbours are fine, and
 * the option the customer is actually on has to stay readable when that happens.
 *
 * @param selected  Whether this option is the current choice.
 * @param available Whether this option still leads to a buyable combination.
 */
function optionClasses(selected: boolean, available: boolean): string {
  if (selected) {
    return available
      ? "border-neon-400 bg-neon-400/10 text-neon-400"
      : "border-neon-400/40 bg-neon-400/5 text-ink-400 line-through";
  }

  return available
    ? "border-line text-ink-200 hover:border-ink-400"
    : "border-ink-800 text-ink-400 line-through";
}

/**
 * One product's image, price, availability, description and options.
 *
 * The image, the price and the selectors all depend on the same choice, so the state has to sit
 * above them - which means one client component owns the whole block. That does not cost the
 * page its HTML: the route is statically rendered, so this component's first render is in the
 * prerendered file and the page shows a real price and a real stock state before any JavaScript
 * runs.
 *
 * The button at the bottom adds the combination on screen to the cart and opens the drawer,
 * which is the receipt for what just happened.
 *
 * @param props.product Product to show, variations included.
 */
export function ProductDetail({ product }: { product: Product }) {
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product));
  const [quantity, setQuantity] = useState(1);

  const add = useCartStore((state) => state.add);
  const openCart = useCartStore((state) => state.open);

  const variation = useMemo(() => findVariation(product, selection), [product, selection]);

  /*
    A variable product always resolves once a combination is chosen; a simple product has no
    variations at all. Both fall back to the product so the markup stays complete either way.
  */
  const image = variation?.image ?? product.image;
  const price = variation?.price ?? product.price.min;
  const inStock = "in-stock" === (variation?.stockStatus ?? product.stockStatus);
  const notice = unavailableMessage(product, selection);

  /**
   * Records the option chosen for one attribute.
   *
   * @param attributeName Taxonomy name of the attribute, e.g. `pa_flavour`.
   * @param slug          Option slug the customer picked.
   */
  function choose(attributeName: string, slug: string) {
    setSelection((current) => ({ ...current, [attributeName]: slug }));
  }

  /**
   * Adds the combination currently on screen, in the quantity currently on screen.
   *
   * Both ids go in, because that is what the checkout API posts: `productId` for a simple
   * product's line, `variationId` as well for a variation's. The quantity is clamped inside the
   * store as well as by the picker, so nothing here can add more of something than the shop
   * allows. The picker goes back to one afterwards: the next addition is a new decision, and
   * leaving the last one standing invites adding three more by accident.
   */
  function addToCart() {
    if (!inStock) {
      return;
    }

    add(
      {
        productId: product.id,
        variationId: variation?.id ?? null,
        slug: product.slug,
        name: product.name,
        options: chosenOptionLabels(product, selection),
        unitPrice: price,
        image,
      },
      quantity,
    );

    setQuantity(1);
    openCart();
  }

  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink-800 bg-ink-900">
        <PhotoTile seed={product.id} />

        {image ? (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            /* This image carries the page, so it is the LCP element and must not be lazy. */
            loading="eager"
            sizes="(min-width: 1024px) 50vw, 100vw"
            /* Uncropped, not cropped: see `product-card.tsx` for why the tile contains its image. */
            className="object-contain"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          {product.category ? (
            <span className="text-xs uppercase tracking-[0.25em] text-ink-400">
              {product.category.name}
            </span>
          ) : null}

          <h1 className="text-3xl font-semibold text-ink-50 sm:text-4xl">{product.name}</h1>

          {/* Announced politely: choosing an option changes the price and may raise a notice. */}
          <div aria-live="polite">
            <div className="flex flex-wrap items-center gap-4">
              <Price min={price} max={price} className="text-2xl font-semibold text-neon-400" />
              <Badge tone={inStock ? "accent" : "muted"}>{inStock ? "In stock" : "Sold out"}</Badge>
            </div>

            {product.attributes.length > 0 ? (
              <p className="mt-2 min-h-6 text-sm text-volt-400">{notice}</p>
            ) : null}
          </div>
        </div>

        {/*
          The HTML comes from this site's own administrator via the seeder, never from a
          visitor. A storefront taking this from user input would sanitise it server-side
          (wp_kses_post) or in the GraphQL layer instead.
        */}
        <div
          className="space-y-4 leading-relaxed text-ink-200"
          dangerouslySetInnerHTML={{ __html: product.description }}
        />

        {product.attributes.length > 0 ? (
          <div className="space-y-5 border-t border-ink-800 pt-6">
            {product.attributes.map((attribute) => (
              <fieldset key={attribute.name}>
                <legend className="text-xs uppercase tracking-[0.2em] text-ink-400">
                  {attribute.label}
                </legend>

                <div className="mt-2 flex flex-wrap gap-2">
                  {attribute.options.map((option) => {
                    const selected = selection[attribute.name] === option.slug;
                    const available = isOptionAvailable(
                      product,
                      selection,
                      attribute.name,
                      option.slug,
                    );

                    return (
                      <label key={option.slug} className="cursor-pointer">
                        {/*
                          Native radios, visually hidden: arrow keys and grouping come free, and
                          a sold-out option stays reachable so the page can explain itself
                          instead of hiding the combination.
                        */}
                        <input
                          type="radio"
                          name={attribute.name}
                          value={option.slug}
                          checked={selected}
                          onChange={() => choose(attribute.name, option.slug)}
                          className="peer sr-only"
                        />
                        <span
                          className={`inline-block rounded-full border px-3 py-1 text-sm transition peer-focus-visible:ring-2 peer-focus-visible:ring-neon-400 ${optionClasses(
                            selected,
                            available,
                          )}`}
                        >
                          {option.label}
                          {available ? null : (
                            <span className="sr-only"> — sold out in this combination</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-ink-800 pt-6">
          <QuantityPicker value={quantity} onChange={setQuantity} productName={product.name} />

          {/*
            Disabled rather than hidden when the chosen combination is sold out: the notice and
            the struck-through option above already say why, and a control that vanishes is
            harder to account for than one that is plainly unavailable.
          */}
          <Button
            type="button"
            size="lg"
            onClick={addToCart}
            disabled={!inStock}
            className="w-full sm:w-auto"
          >
            Add to cart
          </Button>
        </div>
      </div>
    </div>
  );
}
