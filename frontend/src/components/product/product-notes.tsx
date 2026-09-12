import type { Product } from "@/lib/wp/types";

/**
 * What the product is, and what happens if you buy it.
 *
 * Two honest halves. The specification is WordPress's own short description — the field the
 * catalogue has always carried and the storefront has never shown. The shipping line is the same
 * statement the checkout and the footer make: this shop posts no parcel, so the order that gets
 * created is a record rather than a delivery, and the card payment that can run through Stripe is
 * in test mode.
 *
 * The specifications section in between is for the products whose facts came in as data rather than
 * as copy - the imported ones. It is a definition list, not the selectors `ProductDetail` renders:
 * these are facts about the product, so there is nothing here to pick.
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
        line reads as a broken page, and "no specification" is not information. Imported products
        have none, which is why their page leads with specifications instead.
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

          {product.specs.length > 0 ? (
              <section>
                  <h2 className="text-2xl font-semibold text-ink-50">Specifications</h2>
                  <dl className="mt-3 grid max-w-2xl gap-x-8 gap-y-3 sm:grid-cols-2">
                      {product.specs.map((spec) => (
                          <div key={spec.label}>
                              <dt className="text-xs uppercase tracking-[0.2em] text-ink-400">{spec.label}</dt>
                              <dd className="mt-1 text-ink-200">{spec.value}</dd>
                          </div>
                      ))}
                  </dl>
              </section>
          ) : null}

      <section>
        <h2 className="text-2xl font-semibold text-ink-50">Shipping and payment</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-200">
          Nothing ships. Vapestack is a demonstration storefront: the checkout writes a real order
          into WooCommerce and returns its number, a card runs through Stripe in <strong>test
          mode</strong> — so the flow is real and no real card is charged — and no parcel is posted.
          QR payment and cash on delivery are simulations, and say so.
        </p>
      </section>
    </div>
  );
}
