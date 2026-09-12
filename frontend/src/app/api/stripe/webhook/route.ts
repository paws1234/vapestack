/**
 * Stripe's side of the payment conversation.
 *
 * The route is public and unauthenticated - anything on the internet may post to it - so the
 * signature is the only evidence it has that a delivery really came from Stripe, and the raw body
 * is what that signature is computed over. For that reason the body is read as text here and never
 * parsed first.
 *
 * What it does with a real event is deliberately small: an order id out of the intent's metadata,
 * and a call to `markOrderPaid`, which is idempotent. An event for an order this shop does not know
 * is logged and answered 200 rather than retried forever, and a WooCommerce failure is left to
 * throw so Stripe's own retries do the work.
 */

import type Stripe from "stripe";
import { stripe, StripeNotConfiguredError } from "@/lib/stripe/client";
import { markOrderPaid } from "@/lib/stripe/settle";

/*
 * Never prerendered, and never cached: it is a POST that must run when Stripe posts it.
 */
export const dynamic = "force-dynamic";

/**
 * Reads the order id out of a Payment Intent's metadata.
 *
 * @param intent The intent an event carried.
 * @returns The id, or null when the metadata does not name a sane one.
 */
function orderIdFrom(intent: Stripe.PaymentIntent): number | null {
  const id = Number(intent.metadata?.order_id);

  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Takes one delivery from Stripe.
 *
 * @param request Stripe's POST: a JSON event, signed.
 * @returns 200 once the event has been dealt with, or an error Stripe should retry.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  /*
    Without a signing secret there is nothing that could make a delivery trustworthy, so this route
    refuses everything rather than accepting anything it is told.
  */
  if (!secret || !signature) {
    return new Response("No Stripe webhook secret is configured on this shop.", { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return new Response("No Stripe key is configured on this shop.", { status: 503 });
    }

    console.error("Stripe webhook: signature verification failed.", error);

    return new Response("Invalid signature.", { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      const orderId = orderIdFrom(intent);

      if (null === orderId) {
        console.error(`Stripe webhook: ${event.id} names no order in its metadata.`);
        break;
      }

      const result = await markOrderPaid(orderId, intent.id);

      console.log(`Stripe webhook: ${event.id} ${event.type} -> order ${orderId}: ${result}.`);
      break;
    }

    /*
      A failure is not a transition: the order stays `pending`, which is what it is. The customer can
      try another card against the same intent, and nothing here invents a `failed` status that
      WooCommerce's own statuses cannot express without losing that.
    */
    case "payment_intent.payment_failed":
      console.log(`Stripe webhook: ${event.id} ${event.type} acknowledged; the order stays unpaid.`);
      break;

    default:
      break;
  }

  return Response.json({ received: true });
}
