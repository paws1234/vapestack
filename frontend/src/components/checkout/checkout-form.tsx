"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { PaymentMethods } from "@/components/checkout/payment-methods";
import { ThreeDSecure } from "@/components/checkout/three-d-secure";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, TextAreaField } from "@/components/ui/field";
import { Price } from "@/components/ui/price";
import { writeDemoOrder } from "@/lib/demo-order";
import {
  DEFAULT_PAYMENT_METHOD,
  STEP_MESSAGES,
  canTransition,
  cardOutcome,
  digitsOnly,
  isCardValid,
  paymentMethod,
  validateCard,
  type CardErrors,
  type PaymentMethodId,
  type PaymentStep,
} from "@/lib/payment-simulation";
import type { CheckoutRequest } from "@/lib/wp/types";
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

/** The billing details and note, held across the challenge step while the card is authorised. */
type HeldCheckout = {
  billing: CheckoutRequest["billing"];
  note: string;
};

/**
 * The checkout form.
 *
 * The order is created by the route and priced by WooCommerce, so every number shown here is for
 * display and the cart is emptied only once an order exists. A failure leaves the cart alone: the
 * visitor keeps what they had and can try again.
 *
 * The payment block is a small step machine (`idle → validating → challenge → authorising →
 * approved | declined`), written down in `lib/payment-simulation.ts` rather than left to whichever
 * `setState` happens to run, and exposed as `data-state` so an acceptance test reads a state
 * instead of guessing one from the DOM.
 *
 * **The card never leaves this page.** The number, the expiry and the code are read out of the
 * form's own `FormData` at the moment they are checked, and what survives is a single word —
 * `card`, `qr` or `cod`. The billing details are held across the challenge because they do have to
 * be posted; the card fields deliberately are not, so there is nothing to post.
 */
export function CheckoutForm() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);

  const hydrated = useSyncExternalStore(subscribeToHydration, isHydrated, hydrationOnServer);

  const [method, setMethod] = useState<PaymentMethodId>(DEFAULT_PAYMENT_METHOD);
  const [step, setStep] = useState<PaymentStep>("idle");
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** What the visitor filled in, kept across the challenge. Never holds a card field. */
  const held = useRef<HeldCheckout | null>(null);

  /*
    The drawer rehydrates the store on mount, but this form is the thing that must not be wrong
    about the cart, so it does not depend on a sibling having got there first.
  */
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  const subtotal = cartSubtotal(items);
  const declined = "declined" === step;
  /* The dialog stays up while the request is in flight, so the visitor sees it working. */
  const inChallenge = "challenge" === step || "authorising" === step;

  /**
   * Moves the step machine on, refusing a transition it does not have.
   *
   * Guarded rather than trusted: a step can only be reached from a step that leads to it, so the
   * flow cannot jump from `idle` straight to `approved` however the handlers are rearranged later.
   *
   * @param next Step to move to.
   */
  function go(next: PaymentStep): void {
    setStep((current) => (canTransition(current, next) ? next : current));
  }

  /**
   * Posts the held basket and, once an order exists, empties the cart and shows it.
   *
   * The only caller of the API, and it is only ever reached from an approved simulation or from a
   * method that has no challenge to pass.
   */
  async function authorise(): Promise<void> {
    const pending = held.current;

    if (!pending) {
      return;
    }

    go("authorising");
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
          billing: pending.billing,
          payment: method,
          note: pending.note,
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
          /* The same words the shop would have recorded, so the two paths cannot disagree. */
          payment: paymentMethod(method).recorded,
        });

        clear();
        router.push("/checkout/success/demo");

        return;
      }

      if (!response.ok || "number" !== typeof payload?.id) {
        setError(payload?.error ?? "The order could not be created. Please try again.");
        setIsSubmitting(false);
        go("idle");

        return;
      }

      /*
        Only now, and the loading state is deliberately left on: this form is about to be replaced
        by the success page, and clearing the flag would flash the empty-cart notice in between.
      */
      go("approved");
      clear();
      router.push(`/checkout/success/${payload.id}`);
    } catch {
      setError("The checkout could not be reached. Check your connection and try again.");
      setIsSubmitting(false);
      go("idle");
    }
  }

  /**
   * Validates what was typed, then starts the right flow for the chosen method.
   *
   * @param event The form's submit event.
   */
  function placeOrder(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    /* The button is disabled while this runs; a keyboard submit is the way past the button. */
    if (isSubmitting) {
      return;
    }

    const data = new FormData(event.currentTarget);

    const billing: CheckoutRequest["billing"] = {
      firstName: field(data, "firstName"),
      lastName: field(data, "lastName"),
      email: field(data, "email"),
      address1: field(data, "address1"),
      city: field(data, "city"),
      postcode: field(data, "postcode"),
    };

    const note = field(data, "note");

    setError(null);

    if ("card" === method) {
      const fields = {
        name: field(data, "cardName"),
        number: field(data, "cardNumber"),
        expiry: field(data, "cardExpiry"),
        cvc: field(data, "cardCvc"),
      };

      const errors = validateCard(fields, Date.now());

      setCardErrors(errors);

      if (!isCardValid(errors)) {
        /* Still `idle`: nothing was submitted, and the messages are on the fields themselves. */
        go("idle");

        return;
      }

      /*
        The number is read once, here, to decide which sandbox card this is - and then the digits
        go out of scope with `fields`. What is kept is the outcome, not the card.
      */
      const outcome = cardOutcome(digitsOnly(fields.number));

      held.current = { billing, note };
      go("validating");

      if ("declined" === outcome) {
        go("declined");

        return;
      }

      go("challenge");

      return;
    }

    /* QR and cash on delivery have nothing to challenge, so they go straight to the request. */
    held.current = { billing, note };
    go("validating");
    void authorise();
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

      {/*
          `data-state` is the machine's own state, so an acceptance test reads `declined` rather
          than inferring it from which paragraph happens to be on screen.
        */}
      <section data-state={step} className="rounded-3xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="text-lg font-semibold text-ink-50">How you would pay</h2>

        <div className="mt-4">
          <PaymentMethods
            value={method}
            onChange={(next) => {
              setMethod(next);
              setCardErrors({});
              /* Changing the method abandons a decline; there is nothing else to reset. */
              go("idle");
            }}
            cardErrors={cardErrors}
          />
        </div>

        {/*
            The step's own sentence, in a live region: it is the thing that changes on its own and
            the only part of the flow worth interrupting for. `STEP_MESSAGES` holds the copy, so the
            state and what it says cannot drift apart.
          */}
        <p role="status" aria-live="polite" className="sr-only">
          {STEP_MESSAGES[step]}
        </p>
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

      {declined ? (
        <p
          role="alert"
          className="rounded-2xl border border-danger/40 bg-ink-900 px-4 py-3 text-sm text-danger"
        >
          {STEP_MESSAGES.declined}
        </p>
      ) : null}

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
          {isSubmitting ? "Placing the order…" : declined ? "Try another card" : "Place the demo order"}
        </Button>

        <Link
          href="/shop"
          className="text-sm text-ink-400 transition hover:text-neon-400"
          aria-disabled={isSubmitting}
        >
          Keep shopping
        </Link>
      </div>

      {/*
          A step of the checkout rather than a separate overlay: it is rendered here, inside the
          form, and the drawer and the nav are nowhere in this flow. It carries `inert` while
          closed, so a hidden dialog cannot be tabbed into.
        */}
      <ThreeDSecure
        open={inChallenge}
        busy={"authorising" === step}
        onApprove={() => void authorise()}
        onCancel={() => go("idle")}
      />
    </form>
  );
}
