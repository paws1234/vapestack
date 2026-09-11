/**
 * Maps the catalogue's own product images onto copies this app serves itself.
 *
 * WordPress serves its uploads from its own origin, and the deployed app reaches that origin
 * through a tunnel that only exists while the development machine is running. The nine images the
 * seeder generates are therefore committed under `public/products/` and mapped here, so the shop
 * and every product page render completely with WordPress unreachable.
 *
 * The list is explicit rather than a filesystem check on purpose: the app should not depend on what
 * happens to be on disk, and a renamed image is better as a visible miss that falls through to
 * WordPress than as a silent hole.
 */

/** The option slugs the seeder generates an image for, and therefore the files under public/products. */
const LOCAL_PRODUCT_IMAGES = [
  "arctic-white",
  "blue-razz-ice",
  "coastal-tobacco",
  "cola-ice",
  "frost-mint",
  "mango-sunset",
  "midnight-berry",
  "midnight-black",
  "neon-lime",
] as const;

/**
 * WordPress's own generated sizes end in `-<width>x<height>`, so this has to come off before the
 * name can be matched.
 */
const RESIZE_SUFFIX = /-\d+x\d+$/;

/** The seeder writes each image as `vapestack-<option slug>.png`. */
const FILE_PREFIX = "vapestack-";

/**
 * Finds the local copy of a WordPress upload URL.
 *
 * @param url Upload URL as WordPress reported it, possibly with a query string.
 * @returns The path this app serves the image from, or null when it has no local copy.
 */
export function localProductImage(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const path = url.split(/[?#]/)[0];
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const base = filename.replace(/\.png$/i, "").replace(RESIZE_SUFFIX, "");
  const slug = base.startsWith(FILE_PREFIX) ? base.slice(FILE_PREFIX.length) : "";

  return (LOCAL_PRODUCT_IMAGES as readonly string[]).includes(slug) ? `/products/${base}.png` : null;
}
