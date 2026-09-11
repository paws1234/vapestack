import Link from "next/link";
import { CartButton } from "@/components/cart/cart-button";
import { buttonStyles } from "@/components/ui/button";
import { getCategories } from "@/lib/wp/catalog";

/** Wordmark and category navigation. */
export async function Header() {
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-[0.25em] text-ink-50 transition hover:text-neon-400"
        >
          VAPESTACK
        </Link>

        <nav aria-label="Categories" className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/shop" className="text-ink-200 transition hover:text-neon-400">
            Shop
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/shop/${category.slug}`}
              className="text-ink-200 transition hover:text-neon-400"
            >
              {category.name}
            </Link>
          ))}
        </nav>

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

          <CartButton />
        </div>
      </div>
    </header>
  );
}
