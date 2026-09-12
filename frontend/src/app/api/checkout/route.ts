/**
 * Creates a WooCommerce order from the cart, and - for a card - the payment that will pay for it.
 *
 * Server-only by necessity: the WooCommerce and Stripe credentials live in this process, and the
 * browser is told nothing but the new order's identity and, for a card, the client secret of one
 * Payment Intent. Nothing from the client is trusted except product ids and quantities, which are
 * resolved against the catalogue before WooCommerce is asked to do anything and priced by
 * WooCommerce afterwards. **The amount charged is WooCommerce's total**, never the subtotal the
 * browser displayed.
 *
 * **This route never sees a card.** The payment field is one of three published ids, checked
 * against the same list the browser renders, and no field in {@link CheckoutRequest} could hold a
 * card number - the card is entered into Stripe's own fields in the browser, which is why what
 * crosses this boundary is a client secret and not a number.
 *
 * A card order is created `pending` and unpaid, because the money has not moved yet; it becomes
 * `processing` when Stripe says so. An abandoned payment therefore leaves an order that says it was
 * never paid, which is the honest outcome rather than a tidy one.
 */

import { isPaymentMethodId } from "@/lib/payment-simulation";
import { isStripeConfigured, StripeNotConfiguredError } from "@/lib/stripe/client";
import { PAYMENT_INTENT_META, startCardPayment } from "@/lib/stripe/payment";
import { getProducts } from "@/lib/wp/catalog";
import { createOrder, updateOrder, WooCommerceError, type NewOrder } from "@/lib/wp/rest";
import type { CheckoutRequest } from "@/lib/wp/types";
import { UpstreamUnavailableError } from "@/lib/wp/upstream";
import { MAX_QUANTITY } from "@/stores/cart";

/*
 * An order is created per request, so this route may never be prerendered.
 */
export const dynamic = "force-dynamic";

/** Most lines one order may hold. Well above anything the catalogue makes plausible. */
const MAX_LINES = 20;

/** Longest a name, address line or city may be, so nothing absurd reaches the database. */
const MAX_TEXT = 200;

/** Longest order note, which is a demo field rather than correspondence. */
const MAX_NOTE = 500;

/**
 * Just enough of a shape check to catch a typo.
 *
 * Nothing is emailed to this address. The order is the whole journey: the address is stored on it
 * and read back with it. The only mail this site sends is the contact form, in `api/contact`.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A request refused before WordPress is involved. */
class BadRequest extends Error {}

/**
 * Answers with the reason the request was refused.
 *
 * @param message What was wrong with it.
 */
function invalid(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

/**
 * Answers when WordPress or WooCommerce could not be reached, which is not the caller's fault.
 *
 * The detail is logged rather than returned: a refusal from WooCommerce names the endpoint and
 * the permission that was missing, which is diagnosis, not something a visitor can act on.
 *
 * @param what  What failed, for the log line.
 * @param error Whatever was thrown.
 */
function upstream(what: string, error: unknown): Response {
  const detail = error instanceof WooCommerceError ? `${error.status} ${error.message}` : error;

  console.error(`Checkout: ${what} failed.`, detail);

  return Response.json({ error: "The order could not be created. Please try again." }, { status: 502 });
}

/**
 * Answers when Stripe could not be reached or refused the request.
 *
 * The message says what is actually true of the order, because by this point one exists: it is
 * unpaid, WooCommerce records it as pending, and the visitor has been charged nothing.
 *
 * @param what  What failed, for the log line.
 * @param error Whatever was thrown. Never returned: a Stripe refusal names the key or the account,
 *              which is diagnosis rather than something a visitor can act on.
 */
function paymentFailed(what: string, error: unknown): Response {
  console.error(`Checkout: ${what} failed.`, error);

  return Response.json(
    {
      error:
        "The card payment could not be started. Nothing was charged, and your order is recorded as unpaid.",
    },
    { status: 502 },
  );
}

/**
 * Answers when WordPress could not be reached at all.
 *
 * No order exists and none can: this is a demo whose WooCommerce lives behind a tunnel that is only
 * open while the development machine is running, so an unreachable shop is an expected state. The
 * form is told to show a demo receipt for the basket it was about to send, rather than the visitor
 * being left with an error. Nothing is written anywhere, and the response carries nothing the
 * browser did not already have - it knows its own lines and the total it displayed.
 */
function demo(): Response {
  return Response.json({ demo: true });
}

/**
 * Reads a required, non-empty text field.
 *
 * @param value Raw value from the posted body.
 * @param field Name to use in the error message.
 */
function text(value: unknown, field: string): string {
  if ("string" !== typeof value || "" === value.trim()) {
    throw new BadRequest(`${field} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > MAX_TEXT) {
    throw new BadRequest(`${field} is too long.`);
  }

  return trimmed;
}

/**
 * Reads the posted body into the shape WooCommerce will be asked to create.
 *
 * @param body Parsed JSON body, of unknown shape.
 * @throws BadRequest when the body is not a basket this shop can sell.
 */
function parseRequest(body: unknown): CheckoutRequest {
  if (!body || "object" !== typeof body || Array.isArray(body)) {
    throw new BadRequest("The request body must be a JSON object.");
  }

  const { items, billing, note, payment } = body as Record<string, unknown>;

  if (!Array.isArray(items) || 0 === items.length) {
    throw new BadRequest("The cart is empty.");
  }

  if (items.length > MAX_LINES) {
    throw new BadRequest(`An order may hold at most ${MAX_LINES} lines.`);
  }

  const seen = new Set<string>();

  const lines = items.map((item) => {
    if (!item || "object" !== typeof item) {
      throw new BadRequest("Every line has to be an object.");
    }

    const { productId, variationId, quantity } = item as Record<string, unknown>;

    if (!Number.isInteger(productId) || (productId as number) < 1) {
      throw new BadRequest("Every line needs a product id.");
    }

    if (
      null != variationId &&
      (!Number.isInteger(variationId) || (variationId as number) < 1)
    ) {
      throw new BadRequest("A variation id has to be a positive whole number.");
    }

    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_QUANTITY) {
      throw new BadRequest(`Quantities are whole numbers between 1 and ${MAX_QUANTITY}.`);
    }

    const line = {
      productId: productId as number,
      variationId: (variationId ?? null) as number | null,
      quantity: quantity as number,
    };

    /* The cart merges repeats, so a repeat here means a hand-made request. */
    const key = `${line.productId}:${line.variationId ?? 0}`;

    if (seen.has(key)) {
      throw new BadRequest("The same item appears twice.");
    }

    seen.add(key);

    return line;
  });

  if (!billing || "object" !== typeof billing || Array.isArray(billing)) {
    throw new BadRequest("Billing details are required.");
  }

  const fields = billing as Record<string, unknown>;
  const email = text(fields.email, "An email address");

  if (!EMAIL.test(email)) {
    throw new BadRequest("That email address does not look right.");
  }

  const orderNote = "string" === typeof note ? note.trim() : "";

  if (orderNote.length > MAX_NOTE) {
    throw new BadRequest("The order note is too long.");
  }

  /*
   * Checked against the same three ids the browser rendered, so the client cannot talk the shop
   * into a method it has never heard of. A refusal here is a 400, exactly as a bad quantity is.
   */
  if (!isPaymentMethodId(payment)) {
    throw new BadRequest("That payment method is not one this shop offers.");
  }

  return {
    items: lines,
    billing: {
      firstName: text(fields.firstName, "A first name"),
      lastName: text(fields.lastName, "A last name"),
      email,
      address1: text(fields.address1, "An address"),
      city: text(fields.city, "A city"),
      postcode: text(fields.postcode, "A postcode"),
    },
    payment,
    note: orderNote,
  };
}

/**
 * Finds the first reason a basket cannot be bought, or null when it can.
 *
 * The catalogue read is the same one the pages use, so it can be up to five minutes old. That is
 * the deliberate trade for reuse: a second, uncached data path would exist only to catch stock
 * that moves between T2's seeder runs and never does.
 *
 * @param items Lines the client asked for.
 */
async function unbuyable(items: CheckoutRequest["items"]): Promise<string | null> {
  const products = await getProducts();
  const byId = new Map(products.map((product) => [product.id, product]));

  for (const item of items) {
    const product = byId.get(item.productId);

    if (!product) {
      return `Product ${item.productId} is not in the catalogue.`;
    }

    if (null === item.variationId) {
      if ("variable" === product.type) {
        return `${product.name} has options that have to be chosen.`;
      }

      if ("in-stock" !== product.stockStatus) {
        return `${product.name} is out of stock.`;
      }

      continue;
    }

    const variation = product.variations.find((option) => option.id === item.variationId);

    if (!variation) {
      return `That option of ${product.name} does not exist.`;
    }

    if ("in-stock" !== variation.stockStatus) {
      return `${product.name} is out of stock in that option.`;
    }
  }

  return null;
}

/**
 * Creates the order behind a checkout.
 *
 * @param request Posted JSON: the cart's lines, billing details and an optional note.
 * @returns The new order's id and number, or the reason nothing was created.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalid("The request body has to be JSON.");
  }

  let payload: CheckoutRequest;

  try {
    payload = parseRequest(body);
  } catch (error) {
    if (error instanceof BadRequest) {
      return invalid(error.message);
    }

    throw error;
  }

  let reason: string | null;

  try {
    reason = await unbuyable(payload.items);
  } catch (error) {
    if (error instanceof UpstreamUnavailableError) {
      return demo();
    }

    return upstream("the catalogue read", error);
  }

  if (reason) {
    return invalid(reason);
  }

  /*
    Refused before an order exists, so an unconfigured shop reads as what it is rather than as a
    pending order nobody can pay. The card is the only method that needs anything outside
    WooCommerce.
  */
  if ("stripe" === payload.payment && !isStripeConfigured()) {
    return Response.json(
      { error: "This shop has no card payment set up. Choose QR payment or cash on delivery." },
      { status: 503 },
    );
  }

  let order: NewOrder;

  try {
    order = await createOrder(payload);
  } catch (error) {
    /*
     * The catalogue read above is cached, so it can still answer while the tunnel behind it has
     * already closed. That is why this needs the same treatment as the read above rather than
     * relying on it to fail first.
     */
    if (error instanceof UpstreamUnavailableError) {
      return demo();
    }

    return upstream("order creation", error);
  }

  /*
    Only a card has anything else to do. The two simulated methods end here: the order *is* the
    whole record, which is what they have always meant.
  */
  if ("stripe" !== payload.payment) {
    return Response.json({ id: order.id, number: order.number });
  }

  try {
    /*
      The intent comes after the order, because the amount has to be WooCommerce's own total. Its
      id is written onto the order, which is the only path back from Stripe to this shop - what the
      webhook and the reconcile both follow.
    */
    const started = await startCardPayment(order, payload.billing.email);

    try {
      await updateOrder(order.id, {
        meta_data: [{ key: PAYMENT_INTENT_META, value: started.paymentIntentId }],
      });
    } catch (error) {
      /*
        The payment can still be confirmed and the webhook finds the order through the intent's own
        metadata, so a failed write here is logged rather than turned into a refused checkout. What
        it costs is the read-side reconcile, which is worth knowing about.
      */
      console.error(`Checkout: recording the payment intent on order ${order.id} failed.`, error);
    }

    return Response.json({
      id: order.id,
      number: order.number,
      total: order.total,
      currency: order.currency,
      clientSecret: started.clientSecret,
    });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return Response.json(
        { error: "This shop has no card payment set up. Choose QR payment or cash on delivery." },
        { status: 503 },
      );
    }

    return paymentFailed("starting the card payment", error);
  }
}
