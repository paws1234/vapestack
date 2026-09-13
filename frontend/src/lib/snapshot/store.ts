/**
 * The published copy of the catalogue, and of the shop's photographs.
 *
 * This is what lets the deployed storefront answer without WordPress. A successful read of the
 * whole catalogue is written here; a read that cannot reach WordPress is answered from here. The
 * photographs come from the same database, because the WordPress state mirror already stores every
 * upload in it - so `vapestack_media` is not a second copy of the shop's photographs, it is the
 * copy, written by `mirror/state.sh` when the WordPress container stops.
 *
 * Everything in this file is best effort in one direction and strict in the other:
 *
 * - **Writing never fails a page.** A read that reached WordPress has already succeeded as far as
 *   the visitor is concerned; if the write to PostgreSQL then fails, that is a line in the log and
 *   nothing more.
 * - **Reading never invents data.** A missing row, an unreachable database or an unconfigured
 *   feature all answer `null`, and the caller decides - which in `catalog.ts` means falling back to
 *   the offline notice that was there before this existed.
 */

import { snapshotDatabase } from "./db";

/**
 * The key the catalogue is stored under.
 *
 * Versioned on purpose: the document is the WordPress response verbatim, so a field added to
 * `queries.ts` changes its shape. A version suffix means new code cannot read a document written
 * against an older query and quietly render half a product.
 */
const CATALOGUE_KEY = "catalogue:v1";

/** How long a read of the stored catalogue is reused within one instance. */
const READ_TTL_MS = 60_000;

/** The stored catalogue, and when this instance read it. */
let cached: { at: number; nodes: unknown[] } | null = null;

/**
 * Stores the raw products of a complete catalogue read.
 *
 * Not called with a partial read: `getProducts()` only gets here after the walk followed every
 * `after` cursor, because a document holding one page of three would be a shop that is missing two
 * thirds of its products the moment it was needed.
 *
 * @param nodes        Raw products exactly as WordPress answered them.
 * @param sourceOrigin The WordPress origin they came from, recorded for diagnosis.
 */
export async function saveCatalogue(nodes: unknown[], sourceOrigin: string | null): Promise<void> {
  const sql = snapshotDatabase();

  if (!sql) {
    return;
  }

  try {
    await sql`
      insert into vapestack_documents (key, document, item_count, source)
      values (${CATALOGUE_KEY}, ${sql.json(nodes as never)}, ${nodes.length}, ${sourceOrigin})
      on conflict (key) do update
        set document   = excluded.document,
            item_count = excluded.item_count,
            source     = excluded.source,
            updated_at = now()
    `;

    cached = { at: Date.now(), nodes };
  } catch (error) {
    console.warn(`[snapshot] could not store the catalogue: ${describe(error)}`);
  }
}

/**
 * Reads the stored catalogue.
 *
 * @returns The raw products of the last successful complete read, or null when there is none.
 */
export async function loadCatalogue(): Promise<unknown[] | null> {
  if (cached && Date.now() - cached.at < READ_TTL_MS) {
    return cached.nodes;
  }

  const sql = snapshotDatabase();

  if (!sql) {
    return null;
  }

  try {
    const rows = await sql<{ document: unknown[] }[]>`
      select document from vapestack_documents where key = ${CATALOGUE_KEY}
    `;

    const nodes = rows[0]?.document ?? null;

    if (Array.isArray(nodes) && nodes.length > 0) {
      cached = { at: Date.now(), nodes };

      return nodes;
    }

    return null;
  } catch (error) {
    console.warn(`[snapshot] could not read the catalogue: ${describe(error)}`);

    return null;
  }
}

/**
 * Reads one uploaded file out of the newest complete WordPress snapshot.
 *
 * The newest **complete** snapshot is the same rule `mirror/state.sh` hydrates from, so what this
 * serves is the media belonging to the state that would be restored - not whatever a half-finished
 * export happened to leave behind.
 *
 * @param path Path inside `wp-content/uploads`, e.g. `2026/09/pm-adalya-1787316859.jpg`.
 * @returns A response body and its content type, or null when the file is not in the snapshot.
 */
export async function loadMedia(path: string): Promise<{ body: Blob; contentType: string } | null> {
  const sql = snapshotDatabase();

  if (!sql) {
    return null;
  }

  try {
    const rows = await sql<{ b64: string | null }[]>`
      select content->>'b64' as b64
        from vapestack_media
       where path = ${path}
         and snapshot_id = (
           select id from vapestack_snapshots where complete order by id desc limit 1
         )
    `;

    const b64 = rows[0]?.b64;

    if (!b64) {
      return null;
    }

    const contentType = contentTypeFor(path);

    /*
     * Decoded into a buffer allocated at a known length rather than straight from the `Buffer` the
     * decoder returns. That is not a style preference: `Buffer` is typed as backed by
     * `ArrayBufferLike`, and neither a response body nor a `Blob` part accepts that in the current
     * `lib.dom`, because the bytes could in principle live in shared memory. A freshly allocated
     * array is unambiguously `ArrayBuffer`-backed, so the cast this replaces is not needed.
     */
    const decoded = Buffer.from(b64, "base64");
    const bytes = new Uint8Array(decoded.byteLength);

    bytes.set(decoded);

    return { body: new Blob([bytes], { type: contentType }), contentType };
  } catch (error) {
    console.warn(`[snapshot] could not read ${path}: ${describe(error)}`);

    return null;
  }
}

/** The content types a WordPress uploads directory actually holds in this project. */
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
};

/**
 * Guesses a content type from an extension.
 *
 * A guess rather than a stored column, because the mirror stores what the file *is* rather than what
 * it is served as, and an uploads directory holds images. Anything unrecognised is sent as a binary
 * stream, which is wrong for nothing that can appear here and does not lie about the rest.
 *
 * @param path Path inside `wp-content/uploads`.
 */
function contentTypeFor(path: string): string {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();

  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/**
 * Turns whatever a database driver threw into something worth logging.
 *
 * @param error Whatever was caught.
 */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
