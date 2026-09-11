"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GROUP_LABEL, splitRanges } from "@/lib/nav";
import { useDisclosure } from "@/lib/use-disclosure";
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
 * is handed. The mobile panel does the same thing for itself — flat, because a vertical list on a
 * phone has no width problem to solve.
 *
 * **Why five ranges sit behind one button.** The catalogue grew to nine ranges, and nine flat links
 * plus Shop and the header's controls need about 700px — more than a tablet has. Grouping the
 * hardware ranges brings the nav to **576px**, which still does not fit at 768 but fits from 1024,
 * so the nav is `lg:flex` and the menu panel covers everything narrower. Every range stays one
 * click away either way. Which ranges are grouped is `lib/nav.ts`'s rule, shared with the footer;
 * the open/close behaviour is `lib/use-disclosure.ts`'s, also shared.
 *
 * @param props.categories Ranges to list, empty when the catalogue could not be read.
 */
export function NavLinks({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const { open, toggle, close, containerRef, triggerRef } = useDisclosure();

  const { inline, grouped } = splitRanges(categories);
  const groupActive = grouped.some((category) => `/shop/${category.slug}` === pathname);

  return (
    <nav aria-label="Categories" className="hidden items-center gap-6 text-sm lg:flex">
      <Link
        href="/shop"
        aria-current={"/shop" === pathname ? "page" : undefined}
        className={linkClasses("/shop" === pathname)}
      >
        Shop
      </Link>

      {inline.map((category) => {
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

      {grouped.length > 0 && (
        <div ref={containerRef} className="relative">
          <button
            type="button"
            ref={triggerRef}
            aria-expanded={open}
            aria-controls="nav-group"
            onClick={toggle}
            className={`${linkClasses(groupActive)} inline-flex items-center gap-1`}
          >
            {GROUP_LABEL}
            <svg
              viewBox="0 0 12 12"
              aria-hidden="true"
              className={`size-3 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" />
            </svg>
          </button>

          <ul
            id="nav-group"
            hidden={!open}
            className="absolute left-0 top-full z-50 mt-3 min-w-48 rounded-2xl border border-line bg-ink-900 p-2 shadow-2xl"
          >
            {grouped.map((category) => {
              const active = `/shop/${category.slug}` === pathname;

              return (
                <li key={category.slug}>
                  <Link
                    href={`/shop/${category.slug}`}
                    aria-current={active ? "page" : undefined}
                    onClick={close}
                    className={`block rounded-xl px-3 py-2 transition ${active
                        ? "bg-neon-400/10 text-neon-400"
                        : "text-ink-200 hover:bg-ink-800 hover:text-neon-400"
                      }`}
                  >
                    {category.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
