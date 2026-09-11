import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { holdDeadline } from "@/lib/cart-hold";
import type { ProductImage } from "@/lib/wp/types";

/**
 * The cart, and whether the drawer is showing.
 *
 * Client-only by design. The order the checkout API creates is priced by WooCommerce, so every
 * number in here is for display and none of it is trusted by the server.
 *
 * Three details matter more than they look:
 *
 * 1. `skipHydration`. A synchronous `localStorage` storage is read while the store is created,
 *    so a returning visitor's items would be in the very first client render while the
 *    prerendered HTML has an empty cart - a hydration mismatch. The drawer rehydrates after
 *    mount instead, which makes the first client render match the HTML exactly.
 * 2. Counts and totals are plain functions over `items`, never stored state. Zustand v5 dropped
 *    the default shallow equality, so a selector that builds a new array or object per call
 *    re-renders forever ("getSnapshot should be cached").
 * 3. `expiresAt` is the only thing here that will change on its own, and it is stored as a
 *    **deadline** rather than as a countdown. The clock that reads it lives in
 *    `lib/use-live-hold.ts` and only runs while the drawer is open: a stored deadline cannot
 *    drift when a background tab is throttled, and nothing ticks for a cart nobody is watching.
 */

/** One line in the cart: enough to render it, plus the ids the checkout API needs. */
export type CartItem = {
  /** WooCommerce product id. Posted as `product_id`. */
  productId: number;
  /** Variation id for a variable product, null for a simple one. Posted as `variation_id`. */
  variationId: number | null;
  /** Identity of the line: the same variation added twice is one line with a bigger quantity. */
  key: string;
  /** Product slug, so a line can link back to its page. */
  slug: string;
  name: string;
  /** Option labels in attribute order, e.g. `["Frost Mint", "3mg"]`, not taxonomy and slugs. */
  options: string[];
  /** Display only; WooCommerce prices the order. */
  unitPrice: number;
  image: ProductImage | null;
  quantity: number;
};

/** The most of one thing anybody can buy here. The checkout API bounds quantities to match. */
export const MAX_QUANTITY = 99;

/** The value a quantity is clamped to when it arrives as nonsense from restored storage. */
const MIN_QUANTITY = 1;

/**
 * Identity of a line.
 *
 * Both ids, so a simple product's line and a variation's line can never merge by accident.
 *
 * @param productId   WooCommerce product id.
 * @param variationId Variation id, or null for a simple product.
 */
export function cartKey(productId: number, variationId: number | null): string {
  return `${productId}:${variationId ?? 0}`;
}

/**
 * Rounds a quantity into the range this shop allows.
 *
 * @param quantity Requested quantity, possibly nonsense out of a restored storage payload.
 */
export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_QUANTITY;
  }

  return Math.min(Math.max(Math.trunc(quantity), MIN_QUANTITY), MAX_QUANTITY);
}

/**
 * How many things are in the cart, counted per unit rather than per line.
 *
 * @param items Lines in the cart.
 */
export function cartCount(items: CartItem[]): number {
  return items.reduce((total, line) => total + line.quantity, 0);
}

/**
 * What the cart would cost.
 *
 * Display only: WooCommerce prices the order that is actually created, and this total is
 * rounded to cents so a sum of floating-point prices cannot read as $38.969999999999999.
 *
 * @param items Lines in the cart.
 */
export function cartSubtotal(items: CartItem[]): number {
  const total = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return Math.round(total * 100) / 100;
}

type CartState = {
  items: CartItem[];
  /**
   * When the simulated hold on these lines runs out, or null when there is no hold.
   *
   * One deadline for the whole cart rather than one per line: a line added at 09:00 to a cart
   * holding since 08:55 renews the lot, which is the only rule that stays explicable. A cart
   * restored from storage written before this existed has null here and simply has no hold —
   * nothing is invented on load, and the next addition starts one.
   */
  expiresAt: number | null;
  /** Whether the drawer is showing. Never persisted. */
  isOpen: boolean;
  /**
   * Adds a line, or increases the quantity of the one that is already there.
   *
   * Deliberately does not open the drawer: what should happen after an addition is the
   * caller's decision, and the only caller today is the product page's button.
   *
   * @param item     Line to add, without the key and quantity this store supplies.
   * @param quantity How many, clamped to the allowed range.
   */
  add: (item: Omit<CartItem, "key" | "quantity">, quantity?: number) => void;
  /**
   * Drops a line.
   *
   * @param key Identity of the line, from {@link cartKey}.
   */
  remove: (key: string) => void;
  /**
   * Sets a line's quantity, clamped.
   *
   * @param key      Identity of the line.
   * @param quantity Requested quantity.
   */
  setQuantity: (key: string, quantity: number) => void;
  /** Empties the cart. Called once an order exists, never before. */
  clear: () => void;
  /** Starts a fresh hold from now, which is what the expired banner's button does. */
  extendHold: () => void;
  /** Shows the drawer. */
  open: () => void;
  /** Hides the drawer. */
  close: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      expiresAt: null,
      isOpen: false,

      add: (item, quantity = 1) =>
        set((state) => {
          const key = cartKey(item.productId, item.variationId);
          const existing = state.items.find((line) => line.key === key);
          /* Adding anything renews the whole hold, including when it had already run out. */
          const expiresAt = holdDeadline(Date.now());

          if (!existing) {
            return {
              items: [...state.items, { ...item, key, quantity: clampQuantity(quantity) }],
              expiresAt,
            };
          }

          return {
            items: state.items.map((line) =>
              line.key === key ? { ...line, quantity: clampQuantity(line.quantity + quantity) } : line,
            ),
            expiresAt,
          };
        }),

      remove: (key) =>
        set((state) => {
          const items = state.items.filter((line) => line.key !== key);

          return {
            items,
            /* A hold over nothing is not a hold, so dropping the last line ends it. */
            expiresAt: 0 === items.length ? null : state.expiresAt,
          };
        }),

      setQuantity: (key, quantity) =>
        set((state) => ({
          items: state.items.map((line) =>
            line.key === key ? { ...line, quantity: clampQuantity(quantity) } : line,
          ),
        })),

      clear: () => set({ items: [], expiresAt: null }),

      extendHold: () => set({ expiresAt: holdDeadline(Date.now()) }),

      open: () => set({ isOpen: true }),

      close: () => set({ isOpen: false }),
    }),
    {
      name: "vapestack-cart",
      /*
        Bumped when `CartItem` changes shape. It is also the cheap way to drop carts holding
        variation ids that no longer exist, which happens whenever the catalogue is reseeded
        from scratch because the seeder recreates the products with new ids.

        Not bumped for `expiresAt`: adding a key does not change the shape of a line, and a cart
        restored without one keeps the null default instead of being thrown away.
      */
      version: 1,
      storage: createJSONStorage(() => localStorage),
      /* Only what belongs to the visitor: a reload must not reopen a drawer. */
      partialize: (state) => ({ items: state.items, expiresAt: state.expiresAt }),
      skipHydration: true,
    },
  ),
);
