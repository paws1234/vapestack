import Link from "next/link";
import { CartButton } from "@/components/cart/cart-button";
import { MobileNavButton } from "@/components/layout/mobile-nav-button";
import { NavLinks } from "@/components/layout/nav-links";
import { SearchButton } from "@/components/search/search-button";
import { buttonStyles } from "@/components/ui/button";
import { getCatalogue } from "@/lib/wp/catalog";

/** Wordmark and category navigation. */
export async function Header() {
  /*
    A header is not worth failing a page over. With WordPress unreachable the navigation falls back
    to the plain shop link, and the page below it decides what to say about the missing catalogue.
  */
  const categories = (await getCatalogue())?.categories ?? [];

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

        <NavLinks categories={categories} />

        {/*
          At mobile widths the nav is hidden and the header is tight, so the wordmark and the
          cart are what is left; "Shop all" is a desktop convenience the categories also cover.

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

          {/*
            Icon-only and named by its label: the header's controls are the wordmark plus four
            round buttons, so a word would not fit at 320px. It opens the dialog the layout mounts,
            and it is the only thing that does - the docked overlay cannot be inside this element,
            which is `backdrop-blur` and would become the containing block for it.
          */}
          <SearchButton />

          {/*
            Below `md` this is the only way to reach a range: the nav above is hidden and
            "Shop all" is too. It renders itself hidden at `md` and up.
          */}
          <MobileNavButton />

          <CartButton />
        </div>
      </div>
    </header>
  );
}
