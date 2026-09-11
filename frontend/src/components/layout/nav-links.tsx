"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category } from "@/lib/wp/types";

/**
 * Class list for one navigation link.
 *
 * The padding is what makes these comfortable targets: without it a link is only as tall as its
 * 20px line box, under the 24px WCAG 2.5.8 asks of a standalone target (these are not links inside
 * a sentence, so the inline exception does not cover them). It costs no layout — the flex row's
 * height is set by the 36px cart button beside them.
 *
 * The current range is marked with `neon-400` as well as `aria-current`, because colour alone is
 * not an accessible signal — the attribute is what a screen reader reads, the colour is what
 * everyone else sees, and both are needed.
 *
 * @param active Whether this link points at the page being viewed.
 */
function linkClasses(active: boolean): string {
  return `py-1 transition ${active ? "text-neon-400" : "text-ink-200 hover:text-neon-400"}`;
}

/**
 * The header's range navigation.
 *
 * A client component only because the current path is a browser fact on a server-rendered header:
 * `Header` stays a server component and keeps reading the catalogue, and this renders the links it
 * is handed. The mobile panel does the same thing for itself.
 *
 * @param props.categories Ranges to list, empty when the catalogue could not be read.
 */
export function NavLinks({ categories }: { categories: Category[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Categories" className="hidden items-center gap-6 text-sm md:flex">
      <Link
        href="/shop"
        aria-current={"/shop" === pathname ? "page" : undefined}
        className={linkClasses("/shop" === pathname)}
      >
        Shop
      </Link>

      {categories.map((category) => {
        const active = `/shop/${category.slug}` === pathname;

        return (
          <Link
            key={category.slug}
            href={`/shop/${category.slug}`}
            aria-current={active ? "page" : undefined}
            className={linkClasses(active)}
          >
            {category.name}
          </Link>
        );
      })}
    </nav>
  );
}
