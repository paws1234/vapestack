/**
 * Paging for the listings, kept out of the pages and out of React.
 *
 * The catalogue is read whole (the ranges, the search index and the sitemap are derived from it), so
 * paging is a slice rather than a second query: `getProducts()` already has every product in memory,
 * and asking WordPress for page 3 of a category would be slower and would give the shop two sources
 * of truth for what a listing contains.
 *
 * Deliberately framework-free, like `lib/product-sort.ts`: the pages page on the server, and nothing
 * here reads the environment or imports React.
 */

import { DEFAULT_SORT, type Sort } from "@/lib/product-sort";

/** How many products one page of a listing shows. Nine is three rows of the three-up grid. */
export const PAGE_SIZE = 9;

/** The `page` search parameter, as Next hands it over. */
type RawPage = string | string[] | undefined;

/** One page of a listing, with the numbers a pager and a "showing X–Y" line need. */
export type Paged<T> = {
  items: T[];
  /** 1-based page number. */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first item on this page, or 0 when the list is empty. */
  from: number;
  /** 1-based position of the last item on this page, or 0 when the list is empty. */
  to: number;
};

/** How many pages a listing of `total` items has. Always at least one, even when empty. */
export function pageCountFor(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/**
 * Reads a `page` search parameter.
 *
 * Returns **null** for a request that names a page which does not exist, which the caller turns into
 * a 404 rather than a silently clamped first page: an address that says `?page=99` and shows page 1
 * is a lie, and this shop already answers a range it does not have with a 404 for the same reason.
 * An absent, empty or unrecognised value is page 1, matching how `parseSort` treats `?sort=`.
 *
 * `?page=` repeated arrives as an array, and is read like a single value.
 *
 * @param raw   The raw search parameter.
 * @param total How many items the unpaged listing holds.
 */
export function parsePage(raw: RawPage, total: number): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (undefined === value || "" === value) {
    return 1;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const page = Number(value);

  return page >= 1 && page <= pageCountFor(total) ? page : null;
}

/**
 * Slices a listing into the requested page.
 *
 * @param items Products, already filtered and already in the requested order.
 * @param page  1-based page number, as `parsePage` returned it.
 */
export function paginate<T>(items: T[], page: number): Paged<T> {
  const pageCount = pageCountFor(items.length);
  const start = (page - 1) * PAGE_SIZE;
  const sliced = items.slice(start, start + PAGE_SIZE);

  return {
    items: sliced,
    page,
    pageCount,
    total: items.length,
    from: 0 === sliced.length ? 0 : start + 1,
    to: start + sliced.length,
  };
}

/**
 * The page numbers a pager should show, with `null` standing for a gap.
 *
 * First and last are always there, plus the current page and its neighbours, because a pager over 33
 * pages has to offer both "the next one" and "jump to the end". A small listing — seven pages or
 * fewer — simply shows every number rather than a gap between two of them.
 *
 * @param page      1-based current page.
 * @param pageCount Total pages.
 */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const numbers = [...wanted].filter((candidate) => candidate >= 1 && candidate <= pageCount).sort((a, b) => a - b);
  const window: (number | null)[] = [];

  for (const [index, number] of numbers.entries()) {
    if (index > 0 && number - numbers[index - 1] > 1) {
      window.push(null);
    }

    window.push(number);
  }

  return window;
}

/** A listing's name for its own page number, for the pager's accessible labels. */
export function pageLabel(page: number): string {
  return `Page ${page}`;
}

/**
 * One page of a listing, as an address.
 *
 * The defaults are left out — `name` ordering and page 1 — so the plain `/shop` survives, and both
 * the ordering and the page are carried when they are not the defaults. One function owns this so
 * that the pager's links, the page's own links and the canonical cannot drift apart: a canonical
 * that dropped `?sort=` would tell a crawler that a sorted listing is the unsorted one, when the
 * ordering is exactly what makes it a different address.
 *
 * @param basePath Listing, e.g. `/shop` or `/shop/vape-coils`.
 * @param sort     Ordering in use.
 * @param page     1-based page number.
 */
export function listingHref(basePath: string, sort: Sort, page = 1): string {
  const params = new URLSearchParams();

  if (DEFAULT_SORT !== sort) {
    params.set("sort", sort);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query ? `${basePath}?${query}` : basePath;
}
