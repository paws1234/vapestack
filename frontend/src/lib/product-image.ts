/**
 * The panel a product photograph sits on.
 *
 * Every product tile in this shop is a tinted panel with the photograph on top of it. When the
 * photograph arrives, the panel is what shows around it; when it never arrives — WordPress
 * unreachable, the optimiser refusing a stale host, an image the catalogue does not have — the
 * panel *is* the fallback, so a card can never render as an empty hole.
 *
 * Pure and framework-free, like `cart-hold.ts` and `cart-rewards.ts`, and deliberately derived from
 * the product's own id rather than from its position on a page: a product keeps its colour wherever
 * it appears, which is why the same function serves the grid, the product page and the cart.
 */

/*
  The panel is mixed from the two darkest ink values rather than from a rainbow: this is a store
  front on a dark page, and a product's colour should read as a tint of it, not as a swatch.
*/
const INK_900 = "#0b0d13";
const INK_800 = "#12151d";

/** How far round the colour wheel consecutive ids land. */
const HUE_STEP = 47;

/** How much of that hue survives into the panel. Low on purpose: a tint, not a colour. */
const HUE_STRENGTH = 26;

/** How light the tinted stop is. Kept near the ink values so no panel out-shines the page. */
const TINT_LIGHTNESS = 17;

/**
 * The CSS background for a product's panel.
 *
 * @param seed Anything stable per product. A WooCommerce id is what every call site has.
 */
export function placeholderGradient(seed: number): string {
  /*
    47 and 360 share no factors, so consecutive ids travel right round the wheel instead of
    marching through it in visible steps — neighbouring cards look different from each other.
  */
  const hue = (Math.abs(Math.trunc(seed)) * HUE_STEP) % 360;
  const tint = `hsl(${hue} ${HUE_STRENGTH}% ${TINT_LIGHTNESS}%)`;

  return `linear-gradient(140deg, ${INK_900} 0%, ${tint} 55%, ${INK_800} 100%)`;
}
