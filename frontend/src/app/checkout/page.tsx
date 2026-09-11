import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Place a demo order: WooCommerce records it, nothing is charged and nothing ships.",
};

/**
 * Checkout.
 *
 * The page itself is a shell: the cart lives in the browser, so the form that reads it is a
 * client component and everything here is the heading around it.
 */
export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold text-ink-50 sm:text-4xl">Checkout</h1>
      <p className="mt-2 max-w-2xl text-ink-200">
        This creates a real order in WooCommerce, so it can be read back with{" "}
        <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-xs text-ink-200">
          wc_get_orders()
        </code>{" "}
        and found in wp-admin. It is a demo: no payment is taken and nothing ships.
      </p>

      <div className="mt-10">
        <CheckoutForm />
      </div>
    </div>
  );
}
