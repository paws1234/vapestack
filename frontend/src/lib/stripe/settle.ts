/**
 * Making a WooCommerce order tell the truth about whether it has been paid.
 *
 * Two callers, one story. Stripe pushes a `payment_intent.succeeded` event at the webhook, and the
 * success page reads an order that was paid seconds ago — either way the order has to move from
 * `pending` to paid, once, whether or not the other caller got there first.
 *
 * Stripe is the only thing that may answer "the money moved": nothing here trusts a browser, and
 * nothing here trusts an event's own body beyond the order id it names.
 */

import { stripe } from "@/lib/stripe/client";
import { paymentIntentIdFor } from "@/lib/stripe/payment";
import { getOrderSummary, updateOrder } from "@/lib/wp/rest";
import type { OrderSummary } from "@/lib/wp/types";

/**
 * Marks an order paid, if it is not already.
 *
 * Idempotent on purpose: a webhook is delivered at least once, and the success page may ask at the
 * same moment. The second arrival finds the order paid and does nothing, so no order is ever
 * transitioned twice.
 *
 * @param orderId       WooCommerce order id, from Stripe's own metadata.
 * @param transactionId The Payment Intent's id, recorded as the order's transaction.
 * @returns What happened, for the log line: `missing`, `already` or `marked`.
 * @throws WooCommerceError when WooCommerce refuses, which the webhook answers with a 5xx so Stripe
 *                          delivers again.
 */
export async function markOrderPaid(
  orderId: number,
  transactionId: string,
): Promise<"missing" | "already" | "marked"> {
  const order = await getOrderSummary(orderId);

  if (!order) {
    return "missing";
  }

  if ("processing" === order.status || "completed" === order.status) {
    return "already";
  }

  await updateOrder(orderId, {
    status: "processing",
    set_paid: true,
    transaction_id: transactionId,
  });

  return "marked";
}

/**
 * Asks Stripe about an order that is still waiting, and marks it paid if Stripe says the money
 * moved.
 *
 * This is the fallback that makes the webhook a preference rather than a single point of failure: a
 * delivery that is late, lost, or blocked because the WordPress tunnel is closed would otherwise
 * leave a paid order reading as unpaid. It costs one Stripe request, only for an order that is
 * still `pending` and only when the order carries an intent — never for one already paid, and never
 * a new order.
 *
 * @param order The order as it was read, or null when there is no such order.
 * @returns The order, updated in place when Stripe had good news.
 */
export async function reconcileOrder(order: OrderSummary | null): Promise<OrderSummary | null> {
  if (!order || "pending" !== order.status) {
    return order;
  }

  const intentId = await paymentIntentIdFor(order.id);

  if (null === intentId) {
    return order;
  }

  const intent = await stripe().paymentIntents.retrieve(intentId);

  if ("succeeded" !== intent.status) {
    return order;
  }

  const result = await markOrderPaid(order.id, intent.id);

  console.log(`Reconciled order ${order.id} with ${intent.id}: ${result}.`);

  return { ...order, status: "processing" };
}
