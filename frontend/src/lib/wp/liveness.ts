/**
 * Whether the shop behind this site is answering right now.
 *
 * A separate and much cheaper question than the catalogue read, and separate on purpose: the
 * catalogue is served from a five-minute data cache, so it can be minutes out of date and will
 * happily answer while the shop that produced it has gone. This asks WordPress for one field, with
 * a short timeout, and **answers true or false rather than throwing** — it exists to describe the
 * site, not to fail a page.
 *
 * Four things are deliberate here:
 *
 * 1. **GET, not POST.** WordPress's GraphQL endpoint answers both, but GET is the shape Next caches
 *    cleanly, and a probe is a request a proxy should be free to reuse. Verified against this site:
 *    `GET /graphql?query={__typename}` → `200 {"data":{"__typename":"RootQuery"}}` in 137ms.
 * 2. **Not HEAD.** The endpoint answers HEAD with **500**, so a HEAD probe would report the shop
 *    down while it is up.
 * 3. **A short timeout.** Long enough for a quick tunnel on a slow morning, short enough that a
 *    closed one does not hold a page render hostage.
 * 4. **`no-store`, and a ten-second memory of its own.** The first version of this was cached for
 *    ten seconds through Next's data cache, and it was **wrong in exactly the way it was written to
 *    detect**: with WordPress stopped it kept answering "reachable" for minutes, because a cached
 *    entry whose background revalidation fails is served stale rather than replaced — the same trap
 *    the catalogue's five-minute cache sets. A liveness check that is itself stale answers the wrong
 *    question. What replaces it is a plain module-level answer with a `Date.now()` TTL, which a
 *    **failed** probe overwrites like any other, so it cannot get stuck: the status is at most ten
 *    seconds behind, and a page view pays for a probe roughly once every ten seconds rather than on
 *    every request. Measured on this machine: ~90ms for the view that pays, ~15ms for the rest.
 */

import { cache } from "react";

/** How long WordPress has to answer one field before it counts as away. */
const PROBE_TIMEOUT_MS = 1200;

/** How long an answer to the probe may be reused before it is asked again. */
const ANSWER_TTL_MS = 10_000;

/** The last answer and when it was taken. Per server instance, which is all a status strip needs. */
let lastAnswer: { at: number; reachable: boolean } | null = null;

/**
 * Whether WordPress answers right now.
 *
 * @returns True when the endpoint answers 2xx, false when it refuses, times out or is unconfigured.
 */
export const isShopReachable = cache(async (): Promise<boolean> => {
  const now = Date.now();

  if (lastAnswer && now - lastAnswer.at < ANSWER_TTL_MS) {
    return lastAnswer.reachable;
  }

  const reachable = await probeShop();

  lastAnswer = { at: Date.now(), reachable };

  return reachable;
});

/**
 * Asks WordPress for one field.
 *
 * @returns True when the endpoint answers 2xx, false when it refuses, times out or is unconfigured.
 */
async function probeShop(): Promise<boolean> {
  const endpoint = process.env.WP_GRAPHQL_URL;

  if (!endpoint) {
    return false;
  }

  try {
    const response = await fetch(`${endpoint}?query=%7B__typename%7D`, {
      method: "GET",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      /* Never in Next's data cache: see point 4 above. */
      cache: "no-store",
    });

    return response.ok;
  } catch {
    /* Refused, unreachable or too slow: all three mean the same thing to a visitor. */
    return false;
  }
}
