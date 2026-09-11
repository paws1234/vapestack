import Link from "next/link";
import { CartButton } from "@/components/cart/cart-button";
import { MobileNavButton } from "@/components/layout/mobile-nav-button";
import { NavLinks } from "@/components/layout/nav-links";
import { SearchButton } from "@/components/search/search-button";
import { buttonStyles } from "@/components/ui/button";
import type { Category } from "@/lib/wp/types";

/** Wordmark and category navigation. */
export function Header({ categories }: { categories: Category[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:gap-6 sm:px-8">
        {/*
          The wordmark carries less air below `sm` on purpose. At 320px the wordmark, search, menu
          and cart cannot all fit with 0.25em tracking: measured, the controls ended 29px past the
          viewport (x=349 in 320px). Tightening the tracking and the row's gap there is what buys
          the room, rather than hiding a control.
        */}
        <Link
          href="/"
          className="text-base font-semibold tracking-[0.12em] text-ink-50 transition hover:text-neon-400 sm:text-lg sm:tracking-[0.25em]"
        >
          VAPESTACK
        </Link>

        {/*
          The ranges are the nav's business, not the header's: `NavLinks` owns the breakpoint and the
          active-range marking, and reads the current path as a client component so this one can stay
          a server component.
        */}
        <NavLinks categories={categories} />

        {/*
          Below `lg` the inline nav is hidden and the header is tight, so the wordmark and the
          cart are what is left; "Shop all" is a convenience the menu panel also covers.

          `max-md:hidden` rather than `hidden md:inline-flex`: Tailwind v4 emits `.inline-flex`
          after `.hidden`, so the unprefixed `hidden` loses to the display utility `buttonStyles`
          already carries and the link stays visible on a phone. A variant wins on order.
        */}
        <div className="flex items-center gap-3">
          <Link
            href="/shop"
            className={`${buttonStyles("outline", "sm")} max-md:hidden`}
          >
            Shop all
          </Link>

          <SearchButton />
          <MobileNavButton />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
