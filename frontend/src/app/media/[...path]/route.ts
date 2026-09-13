/**
 * Serves one of the shop's photographs out of the published copy.
 *
 * WordPress owns the uploads directory, and the deployment used to reach it - and therefore every
 * product image - through the same tunnel as the catalogue. This route is the other half of not
 * needing that machine: the WordPress state mirror already stores every uploaded file in
 * `vapestack_media`, so `/media/<path inside wp-content/uploads>` answers from there, and the
 * catalogue read points at it whenever it is serving the stored copy.
 *
 * Four things are deliberate:
 *
 * 1. **`force-dynamic`.** Without it Next treats a route handler that reads no request data as
 *    static, evaluates it once at build time - against a database the build may not reach, before
 *    any snapshot need exist - and serves the result forever. That failure is a shop whose images
 *    are all a 404 from a build that looked perfectly healthy.
 * 2. **`immutable` caching.** A WordPress upload never changes under the same name; a new image
 *    gets a new file and a new name. So a response can be cached for as long as the deployment
 *    lives, which keeps the database out of the path of every view after the first in each region.
 * 3. **The path is checked, not trusted.** It arrives from the URL, so it is refused unless it is a
 *    plain relative path under the uploads directory - the same rule `mirror/state.sh` applies when
 *    restoring, for the same reason.
 * 4. **A miss is a 404, never an error page.** The file may genuinely not be in the newest snapshot,
 *    and an image that fails should leave a gap in a card rather than a broken response.
 */

import { loadMedia } from "@/lib/snapshot/store";

export const dynamic = "force-dynamic";

/**
 * Answers one upload.
 *
 * @param _request Unused: the path is the whole request.
 * @param context  Route context, whose `path` is the part after `/media/`.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const relative = path.join("/");

  if (!isUploadPath(relative)) {
    return new Response("Not found", { status: 404 });
  }

  const file = await loadMedia(relative);

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

/**
 * Whether a path is a plain relative path inside the uploads directory.
 *
 * @param path The requested path, e.g. `2026/09/pm-adalya-1787316859.jpg`.
 */
function isUploadPath(path: string): boolean {
  return path.length > 0 && !path.startsWith("/") && !path.includes("..") && /^[A-Za-z0-9._/-]+$/.test(path);
}
