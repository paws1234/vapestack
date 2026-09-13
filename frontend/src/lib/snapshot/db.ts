/**
 * The connection to the durable copy the deployed storefront reads from.
 *
 * The deployed site used to depend on the developer's machine twice over: WordPress for the
 * catalogue, and a tunnel to reach it. Both are gone as of this change. What replaces them is the
 * same PostgreSQL database the WordPress state mirror writes to - so one external copy now serves
 * two purposes, and neither is in the request path for anything that can be answered locally.
 *
 * Three deliberate choices:
 *
 * 1. **Unconfigured means off.** No `MIRROR_DATABASE_URL`, no connection: every caller in
 *    `store.ts` answers "nothing stored" and the app behaves exactly as it did before this existed.
 *    That is what keeps local development, and the checks in this repository, working with no
 *    database at all.
 * 2. **`prepare: false` and a pool of two.** Supabase's pooler is the only address a container or
 *    a serverless function can use (its direct host is IPv6-only) and the port decides which of its
 *    two modes answers; see `applicationUrl` below for why this app needs the transaction one.
 *    Neither mode survives a large client-side statement cache or a stampede of connections, so two
 *    connections, closed after twenty idle seconds, is deliberately small: this is a read path for
 *    a shop that is already serving from its own cache.
 * 3. **A singleton per instance, created lazily.** Serverless instances are recycled constantly, so
 *    the point is only to avoid a new connection per request within one instance's life.
 *
 * The variable is named after the mirror rather than after this app on purpose. It is the same
 * database `mirror/.mirror.env` defines for `mirror/state.sh`, holding the same value, and giving
 * the two halves of the system two names for one secret only creates something else to keep in
 * step.
 */

import postgres from "postgres";

/** The one client this instance will use, created the first time something needs it. */
let client: ReturnType<typeof postgres> | null = null;

/**
 * The database the published copy lives in, or null when the feature is not configured.
 */
export function snapshotDatabase(): ReturnType<typeof postgres> | null {
  const url = process.env.MIRROR_DATABASE_URL;

  if (!url) {
    return null;
  }

  client ??= postgres(applicationUrl(url), {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    /* See point 2 above. A pooler in transaction mode refuses prepared statements outright. */
    prepare: false,
  });

  return client;
}

/**
 * The connection this app should use, which is not the one the mirror was given.
 *
 * Supabase's pooler is two services on one host, and they are not interchangeable:
 *
 * - **Session mode (5432)** holds a server connection for the whole life of each client's
 *   connection and caps concurrent clients at 15. That is right for `mirror/state.sh`, which
 *   connects once and runs a script.
 * - **Transaction mode (6543)** multiplexes many clients onto few server connections, and is what
 *   Supabase documents for serverless. A function platform that scales to a burst of instances
 *   against session mode fails with `(EMAXCONNSESSION) max clients reached in session mode` - which
 *   is not a theoretical limit: it is what every read and write in this file did until the port
 *   below was changed.
 *
 * So the port is the one difference between the two halves of the system, and it is applied here
 * rather than asking for a second copy of the same secret. The rule is deliberately narrow - a
 * Supabase pooler host on the session port - so any other PostgreSQL is left exactly as given.
 *
 * @param url The connection string as configured, e.g. `mirror/.mirror.env`'s value.
 */
export function applicationUrl(url: string): string {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (!parsed.hostname.endsWith(".pooler.supabase.com") || "5432" !== parsed.port) {
    return url;
  }

  /*
   * The port is swapped in the text rather than by re-serialising the parsed URL, because
   * re-serialising runs the credential through percent-encoding and this app has no business
   * rewriting a password it was handed.
   */
  const authority = url.lastIndexOf("@") + 1;

  return url.slice(0, authority) + url.slice(authority).replace(":5432", ":6543");
}
