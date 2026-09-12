import { placeholderGradient } from "@/lib/product-image";

/**
 * The panel behind a product photograph.
 *
 * A server component with no state, on purpose. It is a *backdrop* rather than a loading spinner:
 * it is in the DOM from the start, the photograph paints over it when it arrives, and when the
 * photograph cannot be fetched at all it is what the visitor sees instead of a broken image. There
 * is nothing to detect, so nothing to get wrong — no load event, no hydration race, no client
 * JavaScript for a decorative element.
 *
 * `data-photo-tile` is there for the measurement scripts: it is how a test can tell a panel from a
 * photograph, and (with the `<img>` beside it) how it can tell a tile that is *behind* a
 * photograph from one that is standing in for it.
 *
 * @param props.seed Stable per product — a WooCommerce id — so a product keeps its colour.
 */
export function PhotoTile({ seed }: { seed: number }) {
  return (
    <span
      aria-hidden="true"
      data-photo-tile
      className="absolute inset-0"
      style={{ backgroundImage: placeholderGradient(seed) }}
    />
  );
}
