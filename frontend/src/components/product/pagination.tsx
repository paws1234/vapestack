import Link from "next/link";
import { listingHref, pageLabel, pageWindow, type Paged } from "@/lib/pagination";
import type { Sort } from "@/lib/product-sort";
import type { Product } from "@/lib/wp/types";

/** Pills, matching the range chips so a pager does not introduce a second control style. */
const PAGE = "inline-flex min-w-10 justify-center rounded-full border border-line px-3 py-2 text-sm text-ink-200 transition hover:border-neon-400/60 hover:text-neon-400";
const CURRENT = "inline-flex min-w-10 justify-center rounded-full border border-neon-400 bg-neon-400/10 px-3 py-2 text-sm text-neon-400";
const STEP = "inline-flex items-center rounded-full border border-line px-4 py-2 text-sm text-ink-200 transition hover:border-neon-400/60 hover:text-neon-400";
const STEP_OFF = "inline-flex items-center rounded-full border border-line px-4 py-2 text-sm text-ink-400 opacity-50";

/**
 * The pager under a listing.
 *
 * A server component with no state: every control is a link through `listingHref`, so the ordering
 * is carried into every page and the defaults stay out of the address. That also makes these
 * ordinary `<a>` elements — no click handler, no `router.push` — so the pager works with JavaScript
 * switched off and the back button returns to the page you were on.
 *
 * The numbers shown come from `pageWindow`: first and last always, the current page and its
 * neighbours, gaps between. "Previous" and "Next" are rendered as disabled text at the ends rather
 * than as links to nowhere, so the row does not change width as it moves.
 *
 * @param props.paged    The page being shown.
 * @param props.sort     Ordering in use, carried into every link.
 * @param props.basePath Listing the pager belongs to.
 */
export function Pagination({
  paged,
  sort,
  basePath,
}: {
  paged: Paged<Product>;
  sort: Sort;
  basePath: string;
}) {
  if (paged.pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {paged.page > 1 ? (
        <Link href={listingHref(basePath, sort, paged.page - 1)} rel="prev" className={STEP}>
          ← Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={STEP_OFF}>
          ← Previous
        </span>
      )}

      <ul className="flex flex-wrap items-center justify-center gap-1">
        {pageWindow(paged.page, paged.pageCount).map((number, index) =>
          null === number ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-400">
              …
            </li>
          ) : number === paged.page ? (
            <li key={number}>
              <span aria-current="page" className={CURRENT}>
                {number}
              </span>
            </li>
          ) : (
            <li key={number}>
              <Link href={listingHref(basePath, sort, number)} aria-label={pageLabel(number)} className={PAGE}>
                {number}
              </Link>
            </li>
          ),
        )}
      </ul>

      {paged.page < paged.pageCount ? (
        <Link href={listingHref(basePath, sort, paged.page + 1)} rel="next" className={STEP}>
          Next →
        </Link>
      ) : (
        <span aria-disabled="true" className={STEP_OFF}>
          Next →
        </span>
      )}
    </nav>
  );
}
