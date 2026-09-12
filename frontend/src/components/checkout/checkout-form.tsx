"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, TextAreaField } from "@/components/ui/field";
import { Price } from "@/components/ui/price";
import { writeDemoOrder } from "@/lib/demo-order";
import { cartSubtotal, useCartStore } from "@/stores/cart";

/**
 * Reads a field out of the submitted form.
 *
 * @param data  Submitted form.
 * @param field Field name.
 */
function field(data: FormData, field: string): string {
  const value = data.get(field);

  return "string" === typeof value ? value : "";
}

/**
 * `useSyncExternalStore` needs identities that hold still, so these live at module scope.
 *
 * The store is created with `skipHydration`, so the first client render always has an empty cart
 * - even for a visitor whose storage is full of one. Reading `hasHydrated`, and being told when
 * it flips, is what stops this form from announcing an empty cart to someone whose lines are
 * about to appear a moment later.
 */
function subscribeToHydration(onChange: () => void): () => void {
  return useCartStore.persist.onFinishHydration(onChange);
}

function isHydrated(): boolean {
  return useCartStore.persist.hasHydrated();
}

/** The server cannot read storage, so its answer is always "not yet". */
function hydrationOnServer(): boolean {
  return false;
}

/**
 * The checkout form.
 *
 * The order is created by the route and priced by WooCommerce, so every number shown here is for
 * display and the cart is emptied only once an order exists. A failure leaves the cart alone: the
 * visitor keeps what they had and can try again.
 */
export function CheckoutForm() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);

  const hydrated = useSyncExternalStore(subscribeToHydration, isHydrated, hydrationOnServer);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    The drawer rehydrates the store on mount, but this form is the thing that must not be wrong
    about the cart, so it does not depend on a sibling having got there first.
  */
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  const subtotal = cartSubtotal(items);

  /**
   * Posts the basket and, once an order exists, empties the cart and shows it.
   *
   * @param event The form's submit event.
   */
  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    /* The button is disabled while this runs; a keyboard submit is the way past the button. */
    if (isSubmitting) {
      return;
    }

    const data = new FormData(event.currentTarget);

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ productId, variationId, quantity }) => ({
            productId,
            variationId,
            quantity,
          })),
          billing: {
            firstName: field(data, "firstName"),
            lastName: field(data, "lastName"),
            email: field(data, "email"),
            address1: field(data, "address1"),
            city: field(data, "city"),
            postcode: field(data, "postcode"),
          },
          note: field(data, "note"),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { id?: number; demo?: boolean; error?: string }
        | null;

      /*
        WordPress could not be reached, so no order exists and none was recorded. The visitor's
        flow is not broken: the receipt for what this browser was about to send is kept in the tab,
        because the server has nothing to read back, and the success route shows it as demo mode.
      */
      if (payload?.demo) {
        writeDemoOrder({
          items: items.map((line) => ({
            name: line.name,
            options: line.options,
            quantity: line.quantity,
            total: line.unitPrice * line.quantity,
          })),
          total: subtotal,
        });

        clear();
        router.push("/checkout/success/demo");

        return;
      }

      if (!response.ok || "number" !== typeof payload?.id) {
        setError(payload?.error ?? "The order could not be created. Please try again.");
        setIsSubmitting(false);

        return;
      }

      /*
        Only now, and the loading state is deliberately left on: this form is about to be replaced
        by the success page, and clearing the flag would flash the empty-cart notice in between.
      */
      clear();
      router.push(`/checkout/success/${payload.id}`);
    } catch {
      setError("The checkout could not be reached. Check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  if (!hydrated) {
    return <p className="text-ink-400">Reading your cart…</p>;
  }

  if (0 === items.length && !isSubmitting) {
    return (
      <div className="rounded-3xl border border-ink-800 bg-ink-900 p-8">
        <h2 className="text-lg font-semibold text-ink-50">Your cart is empty</h2>
        <p className="mt-2 text-ink-400">
          Put something in it and the order form will be waiting here.
        </p>

        <Link href="/shop" className={`${buttonStyles("primary", "md")} mt-6`}>
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={placeOrder} className="space-y-6">
      <section className="rounded-3xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="text-lg font-semibold text-ink-50">Your order</h2>

        <ul className="mt-4 divide-y divide-ink-800">
          {items.map((line) => (
            <li key={line.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-ink-50">{line.name}</p>

                {line.options.length > 0 ? (
                  <p className="text-sm text-ink-400">{line.options.join(" · ")}</p>
                ) : null}

                <p className="text-sm text-ink-400">Quantity {line.quantity}</p>
              </div>

              <Price
                min={line.unitPrice * line.quantity}
                max={line.unitPrice * line.quantity}
                className="shrink-0 text-ink-50"
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-ink-800 pt-4">
          <span className="text-sm text-ink-400">Subtotal</span>
          <Price min={subtotal} max={subtotal} className="text-lg font-semibold text-neon-400" />
        </div>

        <p className="mt-3 text-xs text-ink-400">
          WooCommerce prices the order it creates, not this total.
        </p>
      </section>

      <section className="rounded-3xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="text-lg font-semibold text-ink-50">Where it would go</h2>
        <p className="mt-1 text-sm text-ink-400">
          Demo details: no payment is taken and nothing ships.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field id="firstName" name="firstName" label="First name" required autoComplete="given-name" />

          <Field id="lastName" name="lastName" label="Last name" required autoComplete="family-name" />

          <Field
            id="email"
            name="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
            className="sm:col-span-2"
          />

          <Field
            id="address1"
            name="address1"
            label="Address"
            required
            autoComplete="address-line1"
            className="sm:col-span-2"
          />

          <Field id="city" name="city" label="City" required autoComplete="address-level2" />

          <Field id="postcode" name="postcode" label="Postcode" required autoComplete="postal-code" />
        </div>
      </section>

      <section className="rounded-3xl border border-ink-800 bg-ink-900 p-6">
        <TextAreaField
          id="note"
          name="note"
          label="Order note (optional)"
          rows={3}
          placeholder="Anything you would like on the order."
        />
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-danger/40 bg-ink-900 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Placing the order…" : "Place the demo order"}
        </Button>

        <Link
          href="/shop"
          className="text-sm text-ink-400 transition hover:text-neon-400"
          aria-disabled={isSubmitting}
        >
          Keep shopping
        </Link>
      </div>
    </form>
  );
}
