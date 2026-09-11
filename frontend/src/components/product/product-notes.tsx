import type { Product } from "@/lib/wp/types";

/**
 * What the product is, and what happens if you buy it.
 *
 * Two honest halves. The specification is WordPress's own short description — the field the
 * catalogue has always carried and the storefront has never shown. The shipping line is the same
 * statement the checkout and the footer make: this shop takes no payment and posts no parcel, so
 * the order that gets created is a record rather than a delivery.
 *
 * Nothing here is invented. There is no capacity, ingredient list or warranty copy, because the
 * catalogue does not hold any, and a description that reads like a real product page without
 * being one is the one thing a demo storefront must not do.
 *
 * @param props.product Product being described.
 */
export function ProductNotes({ product }: { product: Product }) {
  return (
    <div className="mt-16 space-y-8 border-t border-ink-800 pt-10">
      {/*
        Absent rather than empty when WordPress has no short description: a heading over a blank
        line reads as a broken page, and "no specification" is not information.
      */}
      {product.shortDescription ? (
        <section>
          <h2 className="text-2xl font-semibold text-ink-50">Details</h2>
          {/*
            The HTML comes from this site's own administrator via the seeder, never from a
            visitor — the same trust model the main description is rendered under in
            `product-detail.tsx`.
          */}
          <div
            className="mt-3 max-w-2xl leading-relaxed text-ink-200"
            dangerouslySetInnerHTML={{ __html: product.shortDescription }}
          />
        </section>
      ) : null}

      <section>
        <h2 className="text-2xl font-semibold text-ink-50">Shipping and payment</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-200">
          Nothing ships and nothing is charged. Vapestack is a demonstration storefront: the
          checkout writes a real order into WooCommerce and returns its number, but no payment is
          taken and no parcel is posted.
        </p>
      </section>
    </div>
  );
}
