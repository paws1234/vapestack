/**
 * Creates a WooCommerce order from the cart.
 *
 * Server-only by necessity: the WooCommerce credential lives in this process and the browser is
 * told nothing but the new order's id and number. Nothing from the client is trusted except
 * product ids and quantities, which are resolved against the catalogue before WooCommerce is
 * asked to do anything, and priced by WooCommerce afterwards.
 *
 * **This route never sees a card.** The payment field is one of three published ids, checked
 * against the same list the browser renders; there is no branch here that reads a number, an
 * expiry or a code, and no field in {@link CheckoutRequest} that could hold one. The simulated
 * 3-D Secure challenge completes in the browser before the request is made, and what it leaves
 * behind is the word "card".
 */

import { isPaymentMethodId } from "@/lib/payment-simulation";
import { getProducts } from "@/lib/wp/catalog";
import { createOrder, WooCommerceError } from "@/lib/wp/rest";
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

/** Just enough of a shape check to catch a typo. Nothing is emailed to this address. */
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

  try {
    return Response.json(await createOrder(payload));
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
}
