import Link from "next/link";
import type { Category } from "@/lib/wp/types";

const BASE = "rounded-full border px-4 py-2 text-sm transition";
const SELECTED = `${BASE} border-neon-400 bg-neon-400/10 text-neon-400`;
const UNSELECTED = `${BASE} border-ink-700 text-ink-200 hover:border-neon-400/60 hover:text-neon-400`;

/**
 * Range filter, as links rather than client state so a filtered shop is a real URL.
 *
 * @param props.categories Ranges to offer.
 * @param props.active     Slug of the range currently being viewed, if any.
 */
export function CategoryChips({
  categories,
  active,
}: {
  categories: Category[];
  active?: string;
}) {
  return (
    <nav aria-label="Filter by range" className="flex flex-wrap gap-2">
      <Link href="/shop" className={active ? UNSELECTED : SELECTED}>
        All
      </Link>

      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/shop/${category.slug}`}
          className={active === category.slug ? SELECTED : UNSELECTED}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
