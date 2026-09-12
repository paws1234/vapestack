/**
 * Transport for the WooCommerce REST API.
 *
 * Server-only: it reads WP_REST_URL and the REST credentials, none of which are NEXT_PUBLIC_
 * variables, so nothing here can run in the browser. The checkout route holds the credential and
 * the browser only ever sees an order id.
 *
 * Orders are the only thing that goes through REST. Catalogue reads are GraphQL, and
 * WooCommerce's own cart and checkout mutations were rejected by the plan because they need
 * session-token plumbing for no portfolio-visible gain.
 */

import { paymentMethod } from "@/lib/payment-simulation";
import type { CheckoutRequest, OrderSummary, OrderSummaryLine } from "./types";
import { unreachable, UpstreamUnavailableError } from "./upstream";

/** The order fields this app reads back; everything else WooCommerce returns is ignored. */
type RawOrder = {
  id: number;
  number: string;
  status: string;
  total: string;
  currency: string;
  payment_method: string;
  payment_method_title: string;
  line_items: { name: string; quantity: number; total: string }[];
};

/**
 * A new order, as the checkout route needs it.
 *
 * The total and the currency are WooCommerce's own, and are the only amount anything may charge:
 * they are what the Payment Intent is built from, rather than the browser's subtotal.
 */
export type NewOrder = {
  id: number;
  number: string;
  /** WooCommerce's total for the order, as a decimal string, e.g. `"29.98"`. */
  total: string;
  /** Its currency code, e.g. `"usd"`. */
  currency: string;
};

/** The order fields this app may change once the order exists. */
export type OrderPatch = {
  status?: string;
  set_paid?: boolean;
  transaction_id?: string;
  meta_data?: { key: string; value: string }[];
};

/** How WooCommerce reports a refusal. */
type RawError = { code?: string; message?: string };

/** Longest WooCommerce message passed on. Its own are short, but nothing here is unbounded. */
const MAX_MESSAGE = 300;

/**
 * A refusal from WooCommerce.
 *
 * Carries the status so callers can tell an order that is not there from one that cannot be
 * read at all - which is the difference between a 404 and a 502.
 */
export class WooCommerceError extends Error {
  /** Status WooCommerce answered with, e.g. 404 for an unknown order. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WooCommerceError";
    this.status = status;
  }
}

/**
 * The endpoint and the Basic header, or a loud failure.
 *
 * The pair is either a WooCommerce key and secret or a WordPress user and application password.
 * Over plain HTTP WooCommerce's own authentication only accepts its keys, but WordPress core
 * authenticates the application-password pair on `determine_current_user` regardless, which is
 * what local development relies on.
 */
function credentials(): { endpoint: string; authorization: string } {
  const endpoint = process.env.WP_REST_URL;
  const user = process.env.WP_CONSUMER_KEY;
  const secret = process.env.WP_CONSUMER_SECRET;

  if (!endpoint || !user || !secret) {
    throw new Error(
      "WP_REST_URL, WP_CONSUMER_KEY and WP_CONSUMER_SECRET must all be set. " +
        "Copy .env.local.example to .env.local.",
    );
  }

  return {
    endpoint,
    authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`,
  };
}

/**
 * Turns WooCommerce's error body into something worth logging or passing on.
 *
 * @param payload Body WooCommerce answered with, if it was JSON.
 * @param status  Status it answered with.
 */
function messageFrom(payload: unknown, status: number): string {
  const message = (payload as RawError | null)?.message;

  return "string" === typeof message
    ? message.slice(0, MAX_MESSAGE)
    : `WooCommerce answered ${status}.`;
}

/**
 * Calls the WooCommerce REST API.
 *
 * @param path    Path below WP_REST_URL, starting with a slash, e.g. `/orders/12`.
 * @param options Method and body; a GET with no body by default.
 * @throws WooCommerceError when WooCommerce refuses or cannot be read.
 */
async function wpRest<TData>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
): Promise<TData> {
  const { endpoint, authorization } = credentials();

  let response: Response;

  try {
    response = await fetch(`${endpoint}${path}`, {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: undefined === options.body ? undefined : JSON.stringify(options.body),
      /*
       * Never reused, unlike catalogue reads: both callers need what WooCommerce says now, not
       * what it said when the page was built.
       */
      cache: "no-store",
    });
  } catch (error) {
    throw unreachable(`WooCommerce REST at ${endpoint}`, error);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    /*
     * A 5xx means WooCommerce, or the tunnel in front of it, is broken rather than refusing: the
     * same event as a refused connection, and the checkout answers it with demo mode. A 4xx is a
     * real refusal and keeps its status, which is what tells an unknown order (404) from a
     * permission problem (401).
     */
    if (response.status >= 500) {
      throw new UpstreamUnavailableError(
        `WooCommerce REST answered ${response.status} for ${path}`,
        response.status,
      );
    }

    throw new WooCommerceError(messageFrom(payload, response.status), response.status);
  }

  if (!payload || "object" !== typeof payload) {
    throw new WooCommerceError("WooCommerce returned a response that was not JSON.", response.status);
  }

  return payload as TData;
}

/**
 * Creates the order behind a checkout.
 *
 * Line items carry ids and quantities only - no prices - so WooCommerce prices the order from its
 * own catalogue and a tampered client cannot decide what it costs.
 *
 * The payment the visitor chose is recorded as WooCommerce's own `payment_method` and
 * `payment_method_title`, which the REST API has always accepted - no order meta key was invented
 * for this. Both strings come from `payment-simulation.ts`.
 *
 * **A card order is created `pending` and unpaid**, and is only marked paid when Stripe says the
 * money moved (see {@link updateOrder}, and `markOrderPaid` in the webhook). The two simulated
 * methods keep the `processing` status they have always had: no money is involved, so there is
 * nothing to wait for. The status is the honest record of which of those two things happened.
 *
 * @param request Validated checkout request.
 * @returns The new order's identity, and the total and currency WooCommerce priced it at.
 */
export async function createOrder(request: CheckoutRequest): Promise<NewOrder> {
  const payment = paymentMethod(request.payment);

  const order = await wpRest<RawOrder>("/orders", {
    method: "POST",
    body: {
      status: "stripe" === payment.id ? "pending" : "processing",
      payment_method: payment.slug,
      payment_method_title: payment.recorded,
      set_paid: false,
      billing: {
        first_name: request.billing.firstName,
        last_name: request.billing.lastName,
        email: request.billing.email,
        address_1: request.billing.address1,
        city: request.billing.city,
        postcode: request.billing.postcode,
      },
      customer_note: request.note ?? "",
      line_items: request.items.map((item) => ({
        product_id: item.productId,
        ...(null === item.variationId ? {} : { variation_id: item.variationId }),
        quantity: item.quantity,
      })),
    },
  });

  return {
    id: order.id,
    number: order.number,
    total: order.total,
    currency: order.currency,
  };
}

/**
 * Changes an order that already exists.
 *
 * The only two uses are the two halves of one story: recording the Payment Intent's id when the
 * payment is started, and marking the order paid when Stripe confirms it.
 *
 * @param id    WooCommerce order id.
 * @param patch Fields to change; anything omitted is left alone.
 * @throws WooCommerceError when WooCommerce refuses, e.g. 404 for an unknown order.
 */
export async function updateOrder(id: number, patch: OrderPatch): Promise<void> {
  await wpRest<RawOrder>(`/orders/${id}`, { method: "PUT", body: patch });
}

/**
 * Reads one meta value off an order.
 *
 * Generic on purpose: this module knows about WooCommerce and nothing about what any particular key
 * means, so the Stripe side owns its own key and asks for it here rather than this file learning
 * about payments.
 *
 * @param id  WooCommerce order id.
 * @param key Meta key.
 * @returns The value, or null when the order or the key is not there.
 */
export async function readOrderMeta(id: number, key: string): Promise<string | null> {
  try {
    const order = await wpRest<{ meta_data?: { key: string; value: unknown }[] }>(`/orders/${id}`);
    const row = (order.meta_data ?? []).find((entry) => entry.key === key);

    return "string" === typeof row?.value ? row.value : null;
  } catch (error) {
    if (error instanceof WooCommerceError && 404 === error.status) {
      return null;
    }

    throw error;
  }
}

/**
 * Reads one order, trimmed to what the browser may see.
 *
 * @param id WooCommerce order id.
 * @returns The summary, or null when there is no such order.
 */
export async function getOrderSummary(id: number): Promise<OrderSummary | null> {
  try {
    return toOrderSummary(await wpRest<RawOrder>(`/orders/${id}`));
  } catch (error) {
    if (error instanceof WooCommerceError && 404 === error.status) {
      return null;
    }

    throw error;
  }
}

/**
 * Trims an order down to its number, status, total and lines.
 *
 * Deliberately drops `order_key` and every customer field. `/api/orders/[id]` is public and
 * unauthenticated, so anything returned there can be read by anyone who guesses an id, and
 * neither the success page nor the route needs any of it.
 *
 * @param order Order as WooCommerce returned it.
 */
function toOrderSummary(order: RawOrder): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    total: toAmount(order.total),
    /* The shop's own record of how it was to be paid, and its own words for it. */
    paymentMethod: order.payment_method,
    paymentTitle: order.payment_method_title,
    items: order.line_items.map(
      (line): OrderSummaryLine => ({
        name: line.name,
        quantity: line.quantity,
        total: toAmount(line.total),
      }),
    ),
  };
}

/**
 * Turns one of WooCommerce's decimal strings into a number.
 *
 * @param raw Amount as WooCommerce sends it, e.g. `"27.98"`.
 */
function toAmount(raw: string): number {
  const value = Number.parseFloat(raw);

  return Number.isFinite(value) ? value : 0;
}
