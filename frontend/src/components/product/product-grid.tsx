import Link from "next/link";
import { ProductCard } from "@/components/product/product-card";
import { SortControl } from "@/components/product/sort-control";
import { buttonStyles } from "@/components/ui/button";
import type { Sort } from "@/lib/product-sort";
import type { Product } from "@/lib/wp/types";

/**
 * A grid of products, in the order the page read out of the URL.
 *
 * A server component, and deliberately dumb: the ordering and the filtering both happen before it
 * renders, so what is sent is the grid a visitor asked for rather than one that re-sorts itself
 * once JavaScript arrives. The only interactive thing here is `SortControl`, which is a client
 * component in its own file.
 *
 * @param props.products Products to show, already filtered by the page and already in order.
 * @param props.sort     The ordering in use, so the control never disagrees with the grid.
 */
export function ProductGrid({ products, sort }: { products: Product[]; sort: Sort }) {
  /*
    An empty listing is a designed state rather than an empty grid with a "0 products" line over
    it: the count and the sort control are both meaningless with nothing to count or order, so the
    panel replaces the whole block and offers the one useful way out.
  */
  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.25em] text-neon-400">Nothing listed</p>
        <h2 className="mt-3 text-2xl font-semibold text-ink-50">No products to show here yet</h2>
        <p className="mt-4 text-ink-200">
          Every product in this listing is unpublished, or it has been taken out of the catalogue.
          Vapestack reads that catalogue live from WooCommerce, so this can change on its own.
        </p>
        <p className="mt-3 text-ink-400">The rest of the shop is unaffected.</p>

        <Link href="/shop" className={`${buttonStyles("primary", "md")} mt-8`}>
          Browse the whole shop
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/*
        The page's own `h1` is the listing's title, so the grid needs a heading of its own or the
        cards' `h3`s jump a level. It is `sr-only` because a visible "Products" under "Shop" is
        noise: it is here for the document outline and for anyone navigating by heading, which is
        the only audience that needs it. Found by the T8 sweep (h1 → h3 on /shop and /shop/<range>).
      */}
      <h2 className="sr-only">Products</h2>

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/*
          Announced, because sorting changes this number without a navigation: the select pushes a
          URL and the server re-renders the grid underneath it.
        */}
        <p className="text-sm text-ink-400" aria-live="polite" aria-atomic="true">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>

        <SortControl sort={sort} />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} eager={index < 3} />
        ))}
      </div>
    </div>
  );
}
