import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That address is not part of the Vapestack shop.",
};

/**
 * What an address that matches no route shows.
 *
 * Written as a state page rather than a Next default screen, with the same shape as
 * `OfflineNotice`: an eyebrow, a plain explanation and a way out. It deliberately reads nothing
 * from WordPress — a 404 is the one page that must render when the catalogue is the thing that
 * went wrong, so it has no reason to depend on it.
 */
export default function NotFound() {
  return (
    <Container width="narrow" className="py-16">
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.25em] text-neon-400">404 — not found</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink-50 sm:text-3xl">
          There is nothing at that address
        </h1>
        <p className="mt-4 text-ink-200">
          The link may be mistyped, or the product or range it pointed at has since been removed
          from the catalogue. Neither is a fault on your side.
        </p>
        <p className="mt-3 text-ink-400">
          The shop, the ranges and everything currently listed are one tap away.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/shop" className={buttonStyles("primary", "md")}>
            Browse the shop
          </Link>
          <Link href="/" className={buttonStyles("outline", "md")}>
            Back to the home page
          </Link>
        </div>
      </div>
    </Container>
  );
}
