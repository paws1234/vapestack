"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { PaymentMethods } from "@/components/checkout/payment-methods";
import { StripeCard, type CardOrder } from "@/components/checkout/stripe-card";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, TextAreaField } from "@/components/ui/field";
import { Price } from "@/components/ui/price";
import { writeDemoOrder } from "@/lib/demo-order";
import { DEFAULT_PAYMENT_METHOD, paymentMethod, type PaymentMethodId } from "@/lib/payment-simulation";
import { cartSubtotal, useCartStore, type CartItem } from "@/stores/cart";

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
 * The basket as the visitor sees it, and the one total that is theirs rather than the shop's.
 *
 * Shared by the form's own step and the card step after it, so the two cannot drift apart about
 * what is being bought while the visitor is looking at the other one.
 *
 * @param props.items    Lines in the cart.
 * @param props.subtotal What they come to, for display only.
 */
function OrderSummary({ items, subtotal }: { items: CartItem[]; subtotal: number }) {
  return (
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
  );
}

/**
 * The checkout, in two steps.
 *
 * The order is created by the route and priced by WooCommerce, so every number shown here is for
 * display and the cart is emptied only once an order exists. A failure leaves the cart alone: the
 * visitor keeps what they had and can try again.
 *
 * **A card is two steps because the order comes first.** Stripe's fields cannot be rendered without
 * an intent, an intent cannot be created without an amount, and the amount has to be WooCommerce's
 * own total - so the first step collects the details and asks the route for the order and its
 * intent, and the second shows Stripe's element for them. The two simulated methods finish in the
 * first step, because for them the order *is* the whole record.
 *
 * No branch here reads a card number. The card is typed into Stripe's own fields, inside Stripe's
 * own iframe, and what comes back is a status.
 */
export function CheckoutForm() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);

  const hydrated = useSyncExternalStore(subscribeToHydration, isHydrated, hydrationOnServer);

  const [method, setMethod] = useState<PaymentMethodId>(DEFAULT_PAYMENT_METHOD);
  /** The order and intent behind a card payment, once the first step has run. */
  const [card, setCard] = useState<CardOrder | null>(null);
  /** Which step the payment block is on, exposed as `data-state` so a test reads it.
   * (`data-payment-step` on the card block is Stripe's own answer, not this one.) */
  const [phase, setPhase] = useState<"details" | "starting" | "payment" | "paid">("details");
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

  /* One label for the one button, so what it promises matches which step it starts. */
  const submitLabel = isSubmitting
    ? "stripe" === method
      ? "Starting the payment…"
      : "Placing the order…"
    : "stripe" === method
      ? "Continue to payment"
      : "Place the demo order";

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

    if ("stripe" === method) {
      setPhase("starting");
    }

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
          payment: method,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
          id?: number;
          number?: string;
          total?: string;
          clientSecret?: string;
          demo?: boolean;
          error?: string;
        }
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
          /* The same words the shop would have recorded, so the two paths cannot disagree. */
          payment: paymentMethod(method).recorded,
        });

        clear();
        router.push("/checkout/success/demo");

        return;
      }

      if (!response.ok || "number" !== typeof payload?.id) {
        setError(payload?.error ?? "The order could not be created. Please try again.");
        setPhase("details");
        setIsSubmitting(false);

        return;
      }

      /*
        A card stops here: the order and its intent exist, and Stripe's fields are the step after
        this one. The cart is deliberately **not** cleared - nothing has been paid yet, and this
        form may still be abandoned.
      */
      if ("stripe" === method && "string" === typeof payload.clientSecret) {
        setCard({
          id: payload.id,
          number: payload.number ?? String(payload.id),
          total: payload.total ?? String(subtotal),
          clientSecret: payload.clientSecret,
        });
        setPhase("payment");
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
      setPhase("details");
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

  /*
    The second step: Stripe's fields for the order that already exists. The basket is shown again
    rather than left behind, so a visitor paying does not lose sight of what they are paying for -
    and the amount on the button is WooCommerce's, not the one this browser computed.
  */
  if (card) {
    return (
      <div className="space-y-6">
        <OrderSummary items={items} subtotal={subtotal} />

        <section data-state={phase} className="rounded-3xl border border-ink-800 bg-ink-900 p-6">
          <h2 className="text-lg font-semibold text-ink-50">Pay for order {card.number}</h2>
          <p className="mt-1 text-sm text-ink-400">
            Nothing has been charged yet. Your card is entered into Stripe&rsquo;s own fields, in test
            mode, and no card detail reaches this site.
          </p>

          <div className="mt-5">
            <StripeCard
              order={card}
              onPaid={() => {
                setPhase("paid");
                clear();
                router.push(`/checkout/success/${card.id}`);
              }}
            />
          </div>

          <p className="mt-4 text-xs text-ink-400">
            Leaving without paying is allowed: the order is recorded in WooCommerce as unpaid, and
            nothing is charged.
          </p>

          <Link
            href="/shop"
            className="mt-2 inline-block text-sm text-ink-400 transition hover:text-neon-400"
          >
            Back to the shop
          </Link>
        </section>
      </div>
    );
  }

  return (
    <form onSubmit={placeOrder} className="space-y-6">
      <OrderSummary items={items} subtotal={subtotal} />

      <section className="rounded-3xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="text-lg font-semibold text-ink-50">Where it would go</h2>
        <p className="mt-1 text-sm text-ink-400">
          Demo details: nothing ships, and a card runs through Stripe in test mode.
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

      <section data-state={phase} className="rounded-3xl border border-ink-800 bg-ink-900 p-6">
        <PaymentMethods value={method} onChange={setMethod} />
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
          {submitLabel}
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
