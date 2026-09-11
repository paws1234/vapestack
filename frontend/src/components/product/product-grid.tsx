import Link from "next/link";
import { Pagination } from "@/components/product/pagination";
import { ProductCard } from "@/components/product/product-card";
import { SortControl } from "@/components/product/sort-control";
import { buttonStyles } from "@/components/ui/button";
import type { Paged } from "@/lib/pagination";
import type { Sort } from "@/lib/product-sort";
import type { Product } from "@/lib/wp/types";

/**
 * One page of a listing, its pager, and the line that says what is on it.
 *
 * A server component, and deliberately dumb: the filtering, the ordering and the paging all happen
 * before it renders, so what is sent is the page a visitor asked for rather than one that re-sorts
 * itself once JavaScript arrives. It takes the whole `Paged` object rather than a product array so
 * the count line, the grid and the pager cannot disagree about which slice they are showing — there
 * is no way to hand it page 3's products with page 1's numbers.
 *
 * @param props.paged    The page to show, already sliced.
 * @param props.sort     The ordering in use, so the control and the pager never disagree with it.
 * @param props.basePath Listing this page belongs to, e.g. `/shop`.
 */
export function ProductGrid({
  paged,
  sort,
  basePath,
}: {
  paged: Paged<Product>;
  sort: Sort;
  basePath: string;
}) {
  /*
    An empty listing is a designed state rather than an empty grid with a "0 products" line over
    it: the count and the sort control are both meaningless with nothing to count or order, so the
    panel replaces the whole block and offers the one useful way out.
  */
  if (paged.total === 0) {
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
          {paged.pageCount > 1
            ? `${paged.from}–${paged.to} of ${paged.total} products`
            : `${paged.total} ${paged.total === 1 ? "product" : "products"}`}
        </p>

        <SortControl sort={sort} />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {paged.items.map((product, index) => (
          <ProductCard key={product.id} product={product} eager={index < 3} />
        ))}
      </div>

      <Pagination paged={paged} sort={sort} basePath={basePath} />
    </div>
  );
}
