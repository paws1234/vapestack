/**
 * The shop's orderings, kept out of the query and out of React.
 *
 * Sorting by price needs a number WordPress does not hand over directly: `price(format: RAW)` on a
 * variable product is a comma-joined list of variation prices, so `catalog.ts` derives the range
 * and this module orders by it. Deliberately framework-free, like `lib/variations.ts`, so the
 * pages can sort on the server and the control can import the option list without pulling in a
 * server-only module — `lib/wp/` reads environment variables and must not reach the browser.
 */

import type { Product } from "@/lib/wp/types";

/** The orderings the shop offers. */
export type Sort = "name" | "price-asc" | "price-desc";

/** What a request with no `sort`, or an unrecognised one, gets. */
export const DEFAULT_SORT: Sort = "name";

/** Select options, in the order they are shown. */
export const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((option) => option.value));

/**
 * Reads a `sort` search parameter.
 *
 * Anything that is not one of the three orderings falls back to the default rather than reaching
 * the comparator, so `?sort=nonsense` renders a normally sorted grid instead of an unsorted one —
 * and `?sort=` repeated (which arrives as an array) is treated the same way.
 *
 * @param raw The raw search parameter, as Next hands it over.
 */
export function parseSort(raw: string | string[] | undefined): Sort {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value && SORT_VALUES.has(value) ? (value as Sort) : DEFAULT_SORT;
}

/**
 * Orders products for display.
 *
 * Returns a copy: the catalogue's own array is cached across requests by React `cache()`, so
 * sorting in place would leak yesterday's order into the next visitor's page.
 *
 * @param products Products to order.
 * @param sort     Ordering to apply.
 */
export function sortProducts(products: Product[], sort: Sort): Product[] {
  const order = [...products];

  switch (sort) {
    case "price-asc":
      return order.sort((a, b) => a.price.min - b.price.min);
    case "price-desc":
      return order.sort((a, b) => b.price.min - a.price.min);
    default:
      return order.sort((a, b) => a.name.localeCompare(b.name));
  }
}
