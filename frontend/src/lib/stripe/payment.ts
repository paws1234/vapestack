/**
 * Starting a card payment for an order WooCommerce has already priced.
 *
 * Server-only: it uses the Stripe client, which reads the secret key. The amount is never taken
 * from the browser — it comes from the order WooCommerce created, converted by
 * {@link toMinorUnits} — so a tampered client cannot decide what it pays.
 *
 * Nothing here reads, stores or returns a card number. The Payment Intent is a claim on an amount;
 * the card itself is entered into Stripe's own fields, in the browser, and never reaches this app.
 */

import { stripe } from "@/lib/stripe/client";
import { toMinorUnits } from "@/lib/stripe/amount";
import { readOrderMeta, type NewOrder } from "@/lib/wp/rest";

/**
 * The order meta key holding the Payment Intent's id.
 *
 * The one link between a WooCommerce order and the payment that is supposed to pay for it, which is
 * what lets a webhook, or a later read, find the order from Stripe's side.
 */
export const PAYMENT_INTENT_META = "_vapestack_payment_intent";

/** What the browser needs to render the payment form. */
export type StartedPayment = {
  /** The intent's id, for the order's own record. */
  paymentIntentId: string;
  /**
   * The intent's client secret, which authorises exactly one payment of exactly one amount.
   *
   * It is not a card and it is not the key: it is safe in the browser, and it must not be logged or
   * kept anywhere but the tab that is paying.
   */
  clientSecret: string;
};

/**
 * Creates the Payment Intent behind a card checkout.
 *
 * Card only, deliberately: wallets need a domain verified in the Stripe dashboard, and every other
 * method brings a redirect the checkout would have to learn about.
 *
 * No `receipt_email`, also deliberately: this site tells visitors that no order email is sent, and
 * Stripe would send one. Setting it is a one-line change that would have to change that copy too.
 *
 * @param order  The order WooCommerce just created, whose total is the amount to charge.
 * @param email  The customer's address, recorded on the intent for reconciliation in the dashboard.
 * @returns The intent's id and its client secret.
 * @throws StripeNotConfiguredError when the shop has no key, and whatever Stripe throws otherwise.
 */
export async function startCardPayment(order: NewOrder, email: string): Promise<StartedPayment> {
  const intent = await stripe().paymentIntents.create({
    amount: toMinorUnits(order.total, order.currency),
    currency: order.currency.toLowerCase(),
    payment_method_types: ["card"],
    description: `Vapestack order ${order.number}`,
    metadata: { order_id: String(order.id), order_number: order.number, email },
  });

  if (!intent.client_secret) {
    throw new Error(`Stripe returned no client secret for order ${order.id}.`);
  }

  return { paymentIntentId: intent.id, clientSecret: intent.client_secret };
}

/**
 * The Payment Intent an order was started with, or null when it never had one.
 *
 * What the reconcile follows from an order to Stripe's own record of the payment, which is why the
 * id is written onto the order when the intent is created.
 *
 * @param orderId WooCommerce order id.
 */
export async function paymentIntentIdFor(orderId: number): Promise<string | null> {
  return readOrderMeta(orderId, PAYMENT_INTENT_META);
}
