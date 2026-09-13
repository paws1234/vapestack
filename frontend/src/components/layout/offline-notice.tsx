import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * What a page shows when there is nothing at all to show.
 *
 * Two things have to fail for this to appear: the live shop must be unreachable, *and* no catalogue
 * may ever have been published to the durable copy. That is what a deployment looks like before its
 * first successful read of the real shop. It is no longer what an ordinary closed tunnel looks
 * like - that is the strip, riding above the catalogue the published copy serves.
 *
 * @param props.what What could not be read, e.g. `catalogue` or `product`.
 */
export function OfflineNotice({ what = "catalogue" }: { what?: string }) {
  return (
    <Container width="narrow" className="py-16">
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.25em] text-neon-400">No catalogue yet</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink-50 sm:text-3xl">
          There is no {what} to show
        </h1>
        <p className="mt-4 text-ink-200">
          Vapestack reads its catalogue from WooCommerce over GraphQL and keeps a published copy of
          it in a database this site can read by itself, which is what visitors normally see when the
          live shop is unreachable. There is no published copy yet, and the live shop is not
          answering either, so there is nothing to list.
        </p>
        <p className="mt-3 text-ink-400">
          This clears itself the first time the live shop answers. The cart and the age gate are
          served by this app itself and still work.
        </p>

        <Link href="/" className={`${buttonStyles("outline", "md")} mt-8`}>
          Back to the home page
        </Link>
      </div>
    </Container>
  );
}
