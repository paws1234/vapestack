/**
 * Transport for the WordPress GraphQL endpoint.
 *
 * Server-only: it reads WP_GRAPHQL_URL, which is deliberately not a NEXT_PUBLIC_
 * variable, so nothing here can run in the browser.
 */

import { unreachable, UpstreamUnavailableError } from "./upstream";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

/** How long a catalogue read may be reused before it is fetched again. */
const REVALIDATE_SECONDS = 300;

/**
 * Posts a query to WordPress and returns its data, or throws with a useful message.
 *
 * `revalidate` is overridable because the two kinds of read want opposite things. The catalogue is a
 * 290-product document that almost never changes, and five minutes of reuse is what keeps a page
 * view from costing a fetch. A page's blocks are one short document that an editor changes *while
 * looking at the site* - so `getPageBlocks()` passes `0`, which means no cache, and an edit is
 * visible on the next reload rather than five minutes later.
 *
 * @param query     GraphQL document.
 * @param variables Variables the document declares.
 * @param options   How the response may be reused; defaults to the catalogue's five minutes.
 */
export async function wpQuery<TData>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { revalidate?: number } = {},
): Promise<TData> {
  const endpoint = process.env.WP_GRAPHQL_URL;

  if (!endpoint) {
    throw new Error(
      "WP_GRAPHQL_URL is not set. Copy .env.local.example to .env.local.",
    );
  }

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: options.revalidate ?? REVALIDATE_SECONDS, tags: ["catalogue"] },
    });
  } catch (error) {
    /* A refused connection or a timeout: WordPress is not there, which callers may handle. */
    throw unreachable(`WordPress GraphQL at ${endpoint}`, error);
  }

  if (!response.ok) {
    /*
     * A 5xx is WordPress or whatever is in front of it failing, which is the same kind of event as
     * a refused connection. Anything else is a request this app got wrong, and stays a plain error
     * so it is not mistaken for the shop being away.
     */
    if (response.status >= 500) {
      throw new UpstreamUnavailableError(
        `WordPress GraphQL answered ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    throw new Error(
      `WordPress GraphQL request failed with ${response.status} ${response.statusText}`,
    );
  }

  let payload: GraphQLResponse<TData>;

  try {
    payload = (await response.json()) as GraphQLResponse<TData>;
  } catch {
    throw new Error("WordPress GraphQL returned a response that was not JSON.");
  }

  if (payload.errors?.length) {
    throw new Error(
      `WordPress GraphQL rejected the query: ${payload.errors
        .map((error) => error.message)
        .join("; ")}`,
    );
  }

  if (!payload.data) {
    throw new Error("WordPress GraphQL returned neither data nor errors.");
  }

  return payload.data;
}
