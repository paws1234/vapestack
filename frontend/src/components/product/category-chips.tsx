import Link from "next/link";
import { DEFAULT_SORT, type Sort } from "@/lib/product-sort";
import type { Category } from "@/lib/wp/types";

const BASE = "rounded-full border px-4 py-2 text-sm transition";
const SELECTED = `${BASE} border-neon-400 bg-neon-400/10 text-neon-400`;
const UNSELECTED = `${BASE} border-line text-ink-200 hover:border-neon-400/60 hover:text-neon-400`;

/**
 * Range filter, as links rather than client state so a filtered shop is a real URL.
 *
 * The ordering rides along in every href: changing range keeps the visitor's sort rather than
 * quietly resetting it, and the chips stay ordinary links, so both the range and the order work
 * with JavaScript switched off.
 *
 * @param props.categories Ranges to offer.
 * @param props.active     Slug of the range being viewed. Absent means "All", which is the only
 *                         listing that omits it — `/shop` itself.
 * @param props.sort       Ordering in use, carried into every link. The default is left out of the
 *                         URL so an unsorted shop keeps the plain `/shop` address.
 */
export function CategoryChips({
  categories,
  active,
  sort,
}: {
  categories: Category[];
  active?: string;
    sort?: Sort;
}) {
  function href(path: string): string {
    return sort && DEFAULT_SORT !== sort ? `${path}?sort=${sort}` : path;
  }

  return (
    <nav aria-label="Filter by range" className="flex flex-wrap gap-2">
      <Link
        href={href("/shop")}
        className={active ? UNSELECTED : SELECTED}
        aria-current={active ? undefined : "page"}
      >
        All
      </Link>

      {categories.map((category) => (
        <Link
          key={category.slug}
          href={href(`/shop/${category.slug}`)}
          className={active === category.slug ? SELECTED : UNSELECTED}
          aria-current={active === category.slug ? "page" : undefined}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
