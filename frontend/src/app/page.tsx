import type { Metadata } from "next";
import Link from "next/link";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { ProductCard } from "@/components/product/product-card";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getCatalogue } from "@/lib/wp/catalog";

/**
 * The shop's front door.
 *
 * Every section is separated by the same `mt-16` the standards doc names — the hero included, so
 * the value is a rule rather than a habit and there is exactly one of it on the page. Every
 * heading below the `h1` is a real `h2` at the section scale: "Ranges" used to be an `h2` styled
 * like an eyebrow, which made the outline read as a section whose title was smaller than its
 * contents.
 *
 * The copy is shop voice. What the stack is and how it is wired belongs on `/about`, so the hero
 * sells the shop and the one paragraph about what this shop actually is sits at the bottom, where
 * a claim that is really a disclaimer belongs. Nothing in the trust band is a badge: no rating,
 * no review count and no payment logo is drawn, because none of them would be true.
 */
export const metadata: Metadata = {
  /*
    Every page names its own canonical. It is declared per route rather than once in the layout
    because a canonical inherited from the root would claim that every page in the site is the
    home page — worse than saying nothing, and the reason the layout leaves this field alone.
  */
  alternates: { canonical: "/" },
};

export default async function Home() {
  const catalogue = await getCatalogue();

  if (!catalogue) {
    return <OfflineNotice />;
  }

  const { categories, products } = catalogue;

  // One product per range, so the home page shows the breadth of the shop without
  // duplicating the listing page.
  const featured = categories.flatMap((category) => {
    const product = products.find((candidate) => candidate.category?.slug === category.slug);

    return product ? [product] : [];
  });

  /*
    The second call to action named the range the shop stocks least of: it was hardcoded to
    `/shop/e-liquids`, and the source publishes exactly one product in that range. It now names the
    deepest range, tie-broken by name so the choice cannot drift between renders, which means the
    front door's second button always leads somewhere with something behind it.
  */
  const deepest = [...categories].sort(
    (a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name),
  )[0];

  return (
    <Container>
      <section className="relative mt-16 overflow-hidden rounded-3xl border border-ink-800 bg-ink-900 px-6 py-16 sm:px-12 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-neon-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-volt-400/10 blur-3xl"
        />

        <div className="relative max-w-2xl space-y-6">
          {/*
            The hero used to open with an eyebrow listing every range name. With nine ranges that
            was five lines of 12px uppercase on a phone — the tallest and loudest thing in the hero,
            in the same neon as the primary action, and not one word of it clickable. It also said
            what the header nav and the range cards below already say, so the headline leads.
          */}
          {/*
            The headline was "pick a flavour, pick a strength" while the seeded catalogue's variable
            products offered both. They were retired for an all-imported catalogue of simple
            products, so the shop no longer has a choice to offer and the promise would be false.
          */}
          <h1 className="text-4xl font-semibold leading-tight text-ink-50 sm:text-6xl">
            Pick a range, pick a device, see the price.
          </h1>

          <div className="space-y-3">
            <p className="text-lg text-ink-200">
              {products.length} products across {categories.length} ranges, each one priced before it
              reaches the cart.
            </p>

            {/* The shop's age policy is not the tail of a sentence about pricing. */}
            <p className="text-sm text-ink-400">For adults 21 and over.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/shop" className={buttonStyles("primary", "lg")}>
              Shop everything
            </Link>

            {deepest && (
              <Link href={`/shop/${deepest.slug}`} className={buttonStyles("outline", "lg")}>
                Shop {deepest.name}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/*
        A heading over an empty grid is not a state, it is a broken page — the same judgement
        `ProductGrid` makes about its own empty case. When every product is unpublished the
        catalogue has no ranges either (`getCatalogue()` derives them *from* the products), so the
        two catalogue sections are replaced by one designed block rather than rendered empty.
      */}
      {products.length === 0 ? (
        <section className="mt-16">
          <div className="rounded-3xl border border-ink-700 bg-ink-900 p-8 sm:p-10">
            <p className="text-xs uppercase tracking-[0.25em] text-neon-400">Nothing listed</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink-50">
              There is nothing in the catalogue right now
            </h2>
            <p className="mt-4 max-w-2xl text-ink-200">
              The shop reads its catalogue live from WooCommerce, so an empty shop here means every
              product is unpublished there. It can change on its own — this is not an error page.
            </p>

            <Link href="/about" className={`${buttonStyles("outline", "md")} mt-8`}>
              What this shop is
            </Link>
          </div>
        </section>
      ) : (
        <>
            <section className="mt-16">
              <h2 className="text-2xl font-semibold text-ink-50">Shop by range</h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/shop/${category.slug}`}
                    className="group rounded-2xl border border-line bg-ink-900 p-6 transition hover:border-neon-400/60"
                  >
                    <p className="text-lg font-medium text-ink-50">{category.name}</p>
                    <p className="mt-1 text-sm text-ink-400">
                      {category.productCount} {category.productCount === 1 ? "product" : "products"}
                    </p>
                    <span className="mt-4 inline-block text-sm text-neon-400">Browse →</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-16">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-2xl font-semibold text-ink-50">One from each range</h2>
                <Link href="/shop" className="text-sm text-neon-400 transition hover:text-neon-300">
                  See all {products.length} products →
                </Link>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((product) => (
                  <ProductCard key={product.id} product={product} eager />
                ))}
            </div>
          </section>
        </>
      )}

      <section className="mt-16">
        <div className="rounded-3xl border border-ink-800 bg-ink-900 p-6 sm:p-10">
          <h2 className="text-2xl font-semibold text-ink-50">What this shop is</h2>

          <dl className="mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-ink-50">A portfolio demo</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-200">
                Vapestack is a demonstration storefront. The products are invented; the catalogue
                behind them is a real WooCommerce shop, and this front end reads it live rather than
                from a fixture.
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-ink-50">21 and over</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-200">
                The shop carries nicotine products and is intended for adults. It asks your age
                before showing you anything, and keeps the answer in your own browser and nowhere
                else.
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-ink-50">Nothing is charged, nothing ships</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-200">
                The checkout writes a real order into WooCommerce and returns its number. No payment
                is taken, no order is fulfilled and no email is sent.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </Container>
  );
}

