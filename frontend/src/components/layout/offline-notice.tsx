import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

/**
 * What a page shows when WordPress cannot be reached at all.
 *
 * The deployed demo reads its catalogue from WordPress on a development machine, across a tunnel
 * that only exists while that machine is running. A closed tunnel is therefore an expected state,
 * not a fault, so this says so plainly instead of letting the route fail.
 *
 * @param props.what What could not be read, e.g. `catalogue` or `product`.
 */
export function OfflineNotice({ what = "catalogue" }: { what?: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8">
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.25em] text-neon-400">Demo shop offline</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink-50 sm:text-3xl">
          The {what} lives behind a tunnel, and it is closed
        </h1>
        <p className="mt-4 text-ink-200">
          Vapestack reads its catalogue from WooCommerce over GraphQL. That WordPress runs on the
          developer&apos;s own machine and is reachable only while its tunnel is open, which it is
          not at the moment, so there is nothing to list.
        </p>
        <p className="mt-3 text-ink-400">
          Try again shortly. The product images, the cart and the age gate are served by this app
          itself and still work.
        </p>

        <Link href="/" className={`${buttonStyles("outline", "md")} mt-8`}>
          Back to the home page
        </Link>
      </div>
    </div>
  );
}
