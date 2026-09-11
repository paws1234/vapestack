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
