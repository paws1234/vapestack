import { Container } from "@/components/ui/container";
import { isShopReachable } from "@/lib/wp/liveness";

/**
 * A strip that says the shop behind this site is gone, while the site carries on.
 *
 * The pages are served from a five-minute data cache, so a closed tunnel leaves a shop that still
 * lists and prices everything — with no photographs, and a checkout whose card step cannot start.
 * That looked like a broken page rather than an unreachable one, which is what this strip is for:
 * it names the reason instead of letting a visitor guess.
 *
 * It is **not** the whole-page `OfflineNotice`. That one covers a page whose read failed outright;
 * this one rides above pages that are still rendering from the last successful read. Both can
 * appear at once on a route that was never fetched before the tunnel closed, which is fine — this
 * one is the summary, that one is the detail for that page.
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
          <span className="font-semibold text-ink-50">The shop behind this site is offline.</span>{" "}
          WordPress runs on the developer&rsquo;s own machine, behind a tunnel, and that tunnel is
          closed at the moment — so what you are reading comes from the last read, photographs will
          not load, and a card payment cannot start.
        </p>
      </Container>
    </div>
  );
}
