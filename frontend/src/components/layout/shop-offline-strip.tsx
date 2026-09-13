import { Container } from "@/components/ui/container";
import { isShopReachable } from "@/lib/wp/liveness";

/**
 * A strip that says the live shop is not answering, while the site carries on regardless.
 *
 * This used to distinguish a shop from an error page: a closed tunnel meant a shop with no
 * photographs and a checkout that could not start. The deployment no longer depends on that
 * machine - it serves the last catalogue published to its durable copy, photographs included - so
 * the strip now says the one thing that is still true: what you are reading was read at some
 * earlier moment, and ordering is paused.
 *
 * It is **not** the whole-page `OfflineNotice`. That one covers a route with nothing at all to
 * show, which now means no published copy either. Both can appear at once on a route that was
 * never fetched before the live shop went away, which is fine - this one is the summary, that one
 * is the detail for that page.
 *
 * Server-rendered, so it needs no JavaScript and arrives in the first byte, and it is inside the
 * layout, so every route gets it without any page remembering to ask.
 */
export async function ShopOfflineStrip() {
  if (await isShopReachable()) {
    return null;
  }

  return (
    <div className="border-b border-line bg-ink-900">
      <Container className="py-3">
        <p className="text-sm leading-relaxed text-ink-200">
          <span className="font-semibold text-ink-50">The live shop is not answering.</span>{" "}
          What you are reading is the last catalogue this site published, so prices and stock are as
          they were then rather than as they are now, and checkout is paused until the live shop
          comes back. The photographs are served by this site itself, so they still load.
        </p>
      </Container>
    </div>
  );
}
