/**
 * Transport for the WordPress GraphQL endpoint.
 *
 * Server-only: it reads WP_GRAPHQL_URL, which is deliberately not a NEXT_PUBLIC_
 * variable, so nothing here can run in the browser.
 */

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

/** How long a catalogue read may be reused before it is fetched again. */
const REVALIDATE_SECONDS = 300;

/**
 * Posts a query to WordPress and returns its data, or throws with a useful message.
 *
 * @param query     GraphQL document.
 * @param variables Variables the document declares.
 */
export async function wpQuery<TData>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<TData> {
  const endpoint = process.env.WP_GRAPHQL_URL;

  if (!endpoint) {
    throw new Error(
      "WP_GRAPHQL_URL is not set. Copy .env.local.example to .env.local.",
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: REVALIDATE_SECONDS, tags: ["catalogue"] },
  });

  if (!response.ok) {
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
