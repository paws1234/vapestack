/**
 * "WordPress is not there" as one typed failure, shared by both transports.
 *
 * Distinct from a 4xx and from a GraphQL error: nothing about the request is wrong, the shop simply
 * cannot be reached. The deployed demo reads WordPress through a cloudflared tunnel that only
 * exists while the development machine is running, so this is an expected state - the pages answer
 * it with an offline notice and the checkout answers it with a demo-mode confirmation, rather than
 * failing.
 */

/** WordPress could not be reached, or answered as though it were broken. */
export class UpstreamUnavailableError extends Error {
  /** Status WordPress answered with, or null when the request never got that far. */
  readonly status: number | null;

  /**
   * @param message What was being read and why it failed.
   * @param status  Status WordPress answered with, if it answered at all.
   */
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "UpstreamUnavailableError";
    this.status = status;
  }
}

/**
 * Turns whatever a failed `fetch` threw into the typed error.
 *
 * A refused connection, a DNS failure and a timeout all arrive as different errors, and none of
 * them says anything a visitor could act on, so they are flattened here with the endpoint named.
 *
 * @param what  The endpoint that could not be reached, for the log line.
 * @param error Whatever was thrown.
 */
export function unreachable(what: string, error: unknown): UpstreamUnavailableError {
  const detail = error instanceof Error ? error.message : String(error);

  return new UpstreamUnavailableError(`${what} could not be reached: ${detail}`);
}
