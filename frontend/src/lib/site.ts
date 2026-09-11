/**
 * Where this storefront lives, as an absolute origin.
 *
 * Needed by anything that has to say *where* a page is rather than just what it is: canonical
 * links, `metadataBase`, OpenGraph images and the `url` fields in JSON-LD all require an absolute
 * URL, because a consumer of them is not the browser that fetched the page.
 *
 * The value comes from `NEXT_PUBLIC_SITE_URL` so a deployment can name itself without a rebuild
 * of anything but the environment. The localhost default keeps development working with no
 * configuration at all — it is the same origin `next dev` serves.
 */

/** The origin assumed when nothing is configured. */
const DEFAULT_SITE_URL = "http://localhost:3000";

/**
 * The site's origin, without a trailing slash.
 *
 * Trailing slashes are stripped because every caller joins a path starting with `/`, and
 * `https://example.com/` + `/shop` would otherwise be `https://example.com//shop`.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  return (configured || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/**
 * Turns a route or an asset path into an absolute URL.
 *
 * Anything that already carries a scheme is returned untouched. That guard is not decoration: a
 * route here is a bare path (`/shop`) while a product image arrives from WordPress as an absolute
 * URL on its own origin, and both have to survive this function. Prefixing the second kind would
 * produce a URL with two schemes in it.
 *
 * @param path Route or asset path within the site, with or without a leading slash.
 */
export function absoluteUrl(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    return path;
  }

  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
