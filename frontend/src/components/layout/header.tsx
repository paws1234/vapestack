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
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-[0.25em] text-ink-50 transition hover:text-neon-400"
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
          Below `xl` the inline nav is hidden and the header is tight, so the wordmark and the
          cart are what is left; "Shop all" is a desktop convenience the menu panel also covers.

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
