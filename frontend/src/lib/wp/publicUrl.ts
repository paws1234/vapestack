/**
 * Rewrites WordPress-addressed upload URLs onto the origin the browser can reach.
 *
 * WordPress stores absolute upload URLs, so a tunnel turns them into links to the
 * visitor's own machine. Locally the two origins are identical and this is a no-op.
 *
 * The match is on **host and port only, never the scheme**. A TLS-terminating tunnel forwards to
 * plain HTTP WordPress while telling it the request arrived over HTTPS, so `is_ssl()` flips and
 * WordPress advertises its own uploads as `https://localhost:8889/...` - the host is unchanged and
 * only the scheme moves. A literal `http://localhost:8889` prefix test misses that, passes the
 * localhost URL through in silence, and the browser then asks the image optimiser for an origin it
 * does not allow, so every product image answers 400. The scheme of the answer is always the one
 * `WP_PUBLIC_URL` names.
 *
 * Every product image goes through here: the catalogue is imported, and the import copies each
 * product's photograph into the WordPress media library, so there are no image files committed to
 * this app to short-circuit with any more.
 *
 * Server-only: WP_INTERNAL_URL and WP_PUBLIC_URL are not NEXT_PUBLIC_ variables.
 */

/**
 * Maps a URL from the WordPress origin onto the public origin.
 *
 * A URL on any other host, a relative URL and an unparseable one are all returned untouched rather
 * than guessed at.
 *
 * @param url URL as returned by WordPress, or null.
 * @returns The rewritten URL, or null when nothing was supplied.
 */
export function publicUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const internal = process.env.WP_INTERNAL_URL;
  const external = process.env.WP_PUBLIC_URL;

  if (!internal || !external) {
    return url;
  }

  try {
    const source = new URL(url);

    if (source.host !== new URL(internal).host) {
      return url;
    }

    const origin = new URL(external).origin;

    return `${origin}${source.pathname}${source.search}${source.hash}`;
  } catch {
    return url;
  }
}

/** Where an upload sits inside a WordPress URL. */
const UPLOAD_PREFIX = "/wp-content/uploads/";

/** This app's own route for a stored upload. */
const MEDIA_ROUTE = "/media/";

/**
 * The path inside `wp-content/uploads` that a WordPress upload URL names.
 *
 * The inverse of `publicUrl`, and it matches on host and port for the same reason: whether WordPress
 * believes the request arrived over HTTPS is not something this app can rely on.
 *
 * @param url URL as returned by WordPress.
 * @returns The path after `/wp-content/uploads/`, or null when the URL is not one of ours.
 */
export function uploadPathFor(url: string): string | null {
  const internal = process.env.WP_INTERNAL_URL;

  if (!internal) {
    return null;
  }

  try {
    const source = new URL(url);

    if (source.host !== new URL(internal).host) {
      return null;
    }

    return source.pathname.startsWith(UPLOAD_PREFIX) ? source.pathname.slice(UPLOAD_PREFIX.length) : null;
  } catch {
    return null;
  }
}

/**
 * Points every WordPress upload inside a stored document at this app's own media route.
 *
 * The published copy of the catalogue is the WordPress response verbatim - upload URLs and all -
 * and those URLs name a machine that may be switched off. Rewriting them as the document is read
 * keeps the live path untouched: while WordPress *is* reachable, its own URLs are served directly
 * and the image optimiser fetches from it exactly as before, and it is only the stored path that
 * gets URLs the deployment can answer by itself.
 *
 * @param value A parsed document of any shape.
 */
export function rewriteUploadUrls<T>(value: T): T {
  return walk(value) as T;
}

/**
 * The recursion behind `rewriteUploadUrls`.
 *
 * @param value Any JSON value.
 */
function walk(value: unknown): unknown {
  if ("string" === typeof value) {
    const path = uploadPathFor(value);

    return path ? `${MEDIA_ROUTE}${path}` : value;
  }

  if (Array.isArray(value)) {
    return value.map(walk);
  }

  if (value && "object" === typeof value) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, walk(entry)]));
  }

  return value;
}
