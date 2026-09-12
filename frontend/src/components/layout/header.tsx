import Link from "next/link";
import { CartButton } from "@/components/cart/cart-button";
import { MobileNavButton } from "@/components/layout/mobile-nav-button";
import { NavLinks } from "@/components/layout/nav-links";
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
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-[0.25em] text-ink-50 transition hover:text-neon-400"
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
