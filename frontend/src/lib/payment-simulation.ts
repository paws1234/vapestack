/**
 * The ways this shop lets a visitor pay, and what it records about each.
 *
 * Pure and framework-free, like `cart-hold.ts` and `cart-rewards.ts`: the methods are values, so a
 * component reads them instead of inventing them. Nothing here touches storage or the network.
 *
 * One of the three is real. `stripe` is a card payment taken by Stripe in **test mode**: the card is
 * entered into Stripe's own fields and Stripe's own form is what decides whether it is approved, so
 * no part of this app ever holds a card number. The other two are simulations, and every string that
 * describes them - including the title the shop records - says so.
 *
 * This array is also the server's list: a method that is not here is refused by `/api/checkout`.
 */

/** The ways this shop lets a visitor pay. */
export type PaymentMethodId = "stripe" | "qr" | "cod";

/** One selectable method, and the record the shop keeps of it. */
export type PaymentMethod = {
  id: PaymentMethodId;
  /** Radio label. */
  label: string;
  /** One line under the label, in shop voice. */
  summary: string;
  /** What WooCommerce records in `payment_method`. Never shown to the browser. */
  slug: string;
  /** What WooCommerce records in `payment_method_title`, and what the receipt shows. */
  recorded: string;
};

/**
 * The methods, in the order the radio group shows them.
 *
 * A method this list does not hold is refused by `/api/checkout`, so this array is the server's list
 * of what it will accept as well as the browser's list of what it will offer.
 */
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  {
    id: "stripe",
    label: "Card",
    summary:
      "A real card payment through Stripe, in test mode. Your card details go to Stripe and never to this site.",
    slug: "stripe",
    recorded: "Stripe (test mode)",
  },
  {
    id: "qr",
    label: "QR payment",
    summary: "A real, scannable code — it points at this shop. No merchant account, so no charge.",
    slug: "vapestack_qr",
    recorded: "Simulated QR payment (demo)",
  },
  {
    id: "cod",
    label: "Cash on delivery",
    summary: "Simulated: nothing is dispatched, so there is nothing to pay for on arrival.",
    slug: "vapestack_cod",
    recorded: "Simulated cash on delivery (demo)",
  },
];

/** The method a fresh checkout starts on: the one that can actually take a card. */
export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = "stripe";

/** Ids as a lookup, so a posted value can be checked without walking the list. */
const BY_ID = new Map(PAYMENT_METHODS.map((method) => [method.id, method]));

/**
 * Whether a posted value is one of the methods this shop knows.
 *
 * The server's half of the contract: an unknown id is a 400, exactly as a bad quantity is, so the
 * browser cannot talk the API into a method it has never heard of.
 *
 * @param value Raw value from a request body or a store.
 */
export function isPaymentMethodId(value: unknown): value is PaymentMethodId {
  return "string" === typeof value && BY_ID.has(value as PaymentMethodId);
}

/**
 * The method behind an id.
 *
 * @param id One of {@link PAYMENT_METHODS}.
 */
export function paymentMethod(id: PaymentMethodId): PaymentMethod {
  /* Every id in the union is in the map, so this cannot be undefined. */
  return BY_ID.get(id) as PaymentMethod;
}
