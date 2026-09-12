/**
 * The Stripe client, and the one place the secret key is read.
 *
 * Server-only by construction rather than by a comment: `STRIPE_SECRET_KEY` is not a
 * `NEXT_PUBLIC_` variable, so a client component that imported this module would find nothing to
 * read and fail its own request instead of shipping a key to the browser.
 *
 * **The API version is deliberately not passed.** The SDK carries the version it was written
 * against and its types describe that version, so naming one here would either be a no-op or
 * disagree with the types the code is compiled against. `package.json` holds the version that was
 * installed, and that is the record of which API this app speaks.
 */

import Stripe from "stripe";

/**
 * Raised when this process has no Stripe key.
 *
 * A missing key is a state a page has to survive rather than crash on - the shop still sells, and
 * the card method says why it cannot start - so callers name this and answer with a message
 * instead of a 500.
 */
export class StripeNotConfiguredError extends Error {
  constructor() {
    super(
      "STRIPE_SECRET_KEY is not set, so no card payment can be started. " +
        "Run tools/configure-stripe.sh (or put a test key in frontend/.env.local).",
    );
    this.name = "StripeNotConfiguredError";
  }
}

/** The client, and the key it was built from, so a second call does not rebuild it. */
let built: { key: string; client: Stripe } | null = null;

/**
 * Whether this process can talk to Stripe at all.
 *
 * Asked before an order is created rather than after a failure, so an unconfigured shop never
 * leaves a `pending` order behind for a payment that was never going to start. An `sk_live_` key
 * answers yes as well: refusing it here would be a second, weaker copy of the rule that only test
 * keys belong in this project, and `tools/configure-stripe.sh` is where that rule is enforced.
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * The Stripe client.
 *
 * Memoised: a key cannot change while the process is alive, and the client holds a connection pool
 * of its own.
 *
 * @throws StripeNotConfiguredError when `STRIPE_SECRET_KEY` is unset.
 */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new StripeNotConfiguredError();
  }

  if (built?.key !== key) {
    built = { key, client: new Stripe(key) };
  }

  return built.client;
}
