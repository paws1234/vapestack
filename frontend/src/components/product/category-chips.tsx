import Link from "next/link";
import { ChipRangeGroup } from "@/components/product/chip-range-group";
import { CHIP_SELECTED, CHIP_UNSELECTED } from "@/components/product/chip-styles";
import { GROUP_LABEL, splitRanges } from "@/lib/nav";
import { listingHref } from "@/lib/pagination";
import type { Sort } from "@/lib/product-sort";
import type { Category } from "@/lib/wp/types";

/**
 * Range filter, as links rather than client state so a filtered shop is a real URL.
 *
 * The ordering rides along in every href: changing range keeps the visitor's sort rather than
 * quietly resetting it, and the chips stay ordinary links, so both the range and the order work
 * with JavaScript switched off. `listingHref` builds those addresses, the same function the pager
 * and the canonical use.
 *
 * The hardware ranges are **grouped behind one chip** (`ChipRangeGroup`), so a nine-range catalogue
 * is a row of six controls rather than ten that wrap onto three lines on a phone. Which ranges are
 * grouped is `lib/nav.ts`'s rule — the same one the header's menu and the footer's column follow.
 * Switching range deliberately drops the page number: page 3 of a different range means nothing.
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
  const { inline, grouped } = splitRanges(categories);
  const order = sort ?? "name";

  return (
    <nav aria-label="Filter by range" className="flex flex-wrap gap-2">
      <Link
        href={listingHref("/shop", order)}
        className={active ? CHIP_UNSELECTED : CHIP_SELECTED}
        aria-current={active ? undefined : "page"}
      >
        All
      </Link>

      {inline.map((category) => (
        <Link
          key={category.slug}
          href={listingHref(`/shop/${category.slug}`, order)}
          className={active === category.slug ? CHIP_SELECTED : CHIP_UNSELECTED}
          aria-current={active === category.slug ? "page" : undefined}
        >
          {category.name}
        </Link>
      ))}

      {grouped.length > 0 && (
        <ChipRangeGroup label={GROUP_LABEL} items={grouped} active={active} sort={order} />
      )}
    </nav>
  );
}
