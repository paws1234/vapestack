/**
 * Rewrites WordPress-addressed upload URLs onto the origin the browser can reach.
 *
 * WordPress stores absolute upload URLs, so a tunnel turns them into links to the
 * visitor's own machine. Locally the two origins are identical and this is a no-op.
 *
 * Server-only: WP_INTERNAL_URL and WP_PUBLIC_URL are not NEXT_PUBLIC_ variables.
 */

/**
 * Maps a URL from the WordPress origin onto the public origin.
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

  if (!internal || !external || internal === external) {
    return url;
  }

  return url.startsWith(internal) ? `${external}${url.slice(internal.length)}` : url;
}
