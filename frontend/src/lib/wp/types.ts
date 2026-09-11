/**
 * The shapes the storefront works with.
 *
 * Deliberately not GraphQL response types: components should never have to know that a
 * price arrives as a comma-joined string, or that an attribute's display name lives in
 * an inline fragment.
 */

import type { PaymentMethodId } from "@/lib/payment-simulation";

/** Whether something can be bought right now. */
export type StockStatus = "in-stock" | "out-of-stock";

/** An image the browser can load, already rewritten onto the public origin. */
export type ProductImage = {
  url: string;
  alt: string;
};

/** One selectable value of an attribute, e.g. Frost Mint. */
export type ProductOption = {
  slug: string;
  label: string;
};

/** A set of choices on a product, e.g. Flavour: [mint, cola]. */
export type ProductAttribute = {
  /** Taxonomy name, e.g. `pa_flavour`. Keys the matching against variations. */
  name: string;
  /** Display label for the selector, e.g. "Flavour". */
  label: string;
  options: ProductOption[];
};

/**
 * One line of a product's published specifications, e.g. Battery: 1300 mAh.
 *
 * Facts about the product rather than choices on it: the storefront shows them as a list and never
 * as a control.
 */
export type ProductSpec = {
  label: string;
  value: string;
};

/** A buyable combination of a variable product's attributes. */
export type ProductVariation = {
  id: number;
  sku: string;
  price: number;
  stockStatus: StockStatus;
  image: ProductImage | null;
  /** Taxonomy name mapped to option slug, e.g. `{ pa_flavour: "frost-mint" }`. */
  selection: Record<string, string>;
};

/** A product the storefront can render and sell. */
export type Product = {
  id: number;
  name: string;
  slug: string;
  /** WooCommerce SKU. Empty when the product has none. */
  sku: string;
  /** HTML, as authored in WordPress. */
  description: string;
  /** HTML, as authored in WordPress. */
  shortDescription: string;
  category: { name: string; slug: string } | null;
  image: ProductImage | null;
  /** Equal ends when there is only one price. */
  price: { min: number; max: number };
  stockStatus: StockStatus;
  /** Empty for simple products. */
  attributes: ProductAttribute[];
  /** Read-only specifications, e.g. Battery: 1300 mAh. Empty when the product has none. */
  specs: ProductSpec[];
  /** Empty for simple products. */
  variations: ProductVariation[];
  type: "simple" | "variable";
};

/** A category as the storefront presents it, derived from the catalogue. */
export type Category = {
  name: string;
  slug: string;
  productCount: number;
};

/** One line of a checkout request, carrying the ids the cart already holds. */
export type CheckoutLine = {
  productId: number;
  /** Variation id for a variable product, null for a simple one. */
  variationId: number | null;
  quantity: number;
};

/** What the browser posts to the checkout route. */
export type CheckoutRequest = {
  items: CheckoutLine[];
  billing: {
    firstName: string;
    lastName: string;
    email: string;
    address1: string;
    city: string;
    postcode: string;
  };
  /**
   * Which simulated method was chosen.
   *
   * An id and nothing else: no card number, no expiry and no code from the simulated challenge
   * ever reaches this route, which is why the type has nowhere to put one.
   */
  payment: PaymentMethodId;
  /** Optional note attached to the order. */
  note?: string;
};

/** One line of an order, as the success page shows it. */
export type OrderSummaryLine = {
  /** WooCommerce's own label, which already names the variation that was bought. */
  name: string;
  quantity: number;
  total: number;
};

/**
 * An order trimmed to what the browser may see.
 *
 * No order key and no customer details: `/api/orders/[id]` is public, and the success page needs
 * neither.
 */
export type OrderSummary = {
  id: number;
  number: string;
  status: string;
  total: number;
  items: OrderSummaryLine[];
};
