"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 * The ranges the header groups behind one button instead of listing.
 *
 * Matched on the name rather than on a hard-coded list of slugs, because the ranges are derived
 * from the catalogue: the hardware shelf is exactly the ranges that read "Vape <thing>", and a
 * tenth one arriving tomorrow belongs in the same menu without an edit here.
 */
const GROUP_LABEL = "Vape";
const GROUP_PATTERN = /^vape\s/i;

/** Splits the ranges into the ones the header lists and the ones it tucks into the menu. */
function splitRanges(categories: Category[]): { inline: Category[]; grouped: Category[] } {
  const inline: Category[] = [];
  const grouped: Category[] = [];

  for (const category of categories) {
    (GROUP_PATTERN.test(category.name) ? grouped : inline).push(category);
  }

  return { inline, grouped };
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
 * click away either way.
 *
 * **Disclosure, not a menu widget.** The trigger is a `<button>` with `aria-expanded` and
 * `aria-controls` over a plain list of links, which is what the APG calls a disclosure navigation;
 * `aria-haspopup` is deliberately absent, because it would promise a `menu` role the contents do
 * not have. Escape closes it and returns focus to the trigger, a pointer press outside closes it,
 * and following a link closes it — which is why no effect needs to watch the pathname to know a
 * navigation happened.
 *
 * @param props.categories Ranges to list, empty when the catalogue could not be read.
 */
export function NavLinks({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { inline, grouped } = splitRanges(categories);
  const groupActive = grouped.some((category) => `/shop/${category.slug}` === pathname);

  /*
    Listeners exist only while the menu is open: Escape closes it and hands focus back to the
    trigger, and a press anywhere else closes it without stealing focus. A document listener rather
    than `onBlur`, because a click on the page background does not move focus and would leave the
    menu open.
  */
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if ("Escape" !== event.key) {
        return;
      }

      setOpen(false);
      triggerRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (!groupRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

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
        <div ref={groupRef} className="relative">
          <button
            type="button"
            ref={triggerRef}
            aria-expanded={open}
            aria-controls="nav-group"
            onClick={() => setOpen((value) => !value)}
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
                    onClick={() => setOpen(false)}
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
