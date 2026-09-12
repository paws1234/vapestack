"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { absoluteUrl } from "@/lib/site";

/**
 * Stripe's own fields, for the one method that moves money.
 *
 * The card is typed into an iframe that Stripe serves, so no digit of it is ever in this app's DOM,
 * React state, storage or logs. What this component holds is a client secret - which authorises one
 * payment of one amount and nothing else - the status Stripe answers with, and the message it sends
 * when it refuses.
 *
 * **The iframe cannot be styled with Tailwind**, only themed through the Appearance API, which is
 * why the panel around it owns the colour and the `variables` below mirror the tokens in
 * `globals.css`. `frontend/UI-STANDARDS.md` says so as a rule.
 *
 * The amount is the one WooCommerce priced (`order.total`, from the route), never the browser's
 * subtotal: this component displays it, and Stripe was told the same number by the server.
 */

/** What the checkout knows about the order a card payment is paying for. */
export type CardOrder = {
  /** WooCommerce order id. */
  id: number;
  /** WooCommerce order number, as the shop shows it. */
  number: string;
  /** WooCommerce's own total, as a decimal string. The amount Stripe was asked for. */
  total: string;
  /** The intent's client secret: the browser's permission to pay that amount, once. */
  clientSecret: string;
};

/*
  Loaded once for the whole app, at module scope, which is what `loadStripe` is for: it injects
  Stripe.js a single time however many times the checkout is opened. A missing publishable key is
  answered with a message rather than a crash, because the shop is expected to work with Stripe
  unconfigured - only the card method stops.
*/
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

/*
  The tokens from `globals.css`, spelled out because the Appearance API reaches an iframe, where a
  CSS custom property or a Tailwind class cannot. `theme: "night"` supplies whatever these do not.
*/
const APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#b6ff3d", // --color-neon-400
    colorBackground: "#0b0d13", // --color-ink-900
    colorText: "#f5f7fb", // --color-ink-50
    colorTextSecondary: "#c9cfdb", // --color-ink-200
    colorTextPlaceholder: "#7c8598", // --color-ink-400
    colorDanger: "#ff6b6b", // --color-danger
    borderRadius: "12px",
    fontFamily: "inherit",
  },
};

/**
 * The card payment step.
 *
 * @param props.order  The order and the intent the route created for it.
 * @param props.onPaid Called once Stripe reports the payment succeeded.
 */
export function StripeCard({ order, onPaid }: { order: CardOrder; onPaid: () => void }) {
  if (!stripePromise) {
    return (
      <p className="rounded-2xl border border-line bg-ink-950/60 px-4 py-3 text-sm text-ink-200">
        Card payment is not configured on this shop, so no card can be taken. The order is recorded
        in WooCommerce as unpaid.
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret: order.clientSecret, appearance: APPEARANCE }}
    >
      <CardPayment order={order} onPaid={onPaid} />
    </Elements>
  );
}

/** What Stripe says when it refuses without a message of its own. */
const REFUSED =
  "Stripe could not take this card. Nothing was charged - check the details and try again.";

/**
 * The element, the button, and the two states between them.
 *
 * Kept as its own component because `useStripe` and `useElements` only work inside `<Elements>`,
 * and the submit has to happen where the element is.
 *
 * @param props.order  The order being paid for.
 * @param props.onPaid Called once Stripe reports the payment succeeded.
 */
function CardPayment({ order, onPaid }: { order: CardOrder; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();

  const [step, setStep] = useState<"idle" | "paying" | "declined">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const amount = Number(order.total);

  /**
   * Asks Stripe to confirm the payment.
   *
   * `redirect: "if_required"` is the whole reason a card can be paid without leaving the page: an
   * ordinary test card resolves here, and only a step Stripe insists on - its own authentication
   * screen - navigates away, returning to the order's page afterwards.
   *
   * @param event The form's submit event.
   */
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements || "paying" === step) {
      return;
    }

    setStep("paying");
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: absoluteUrl(`/checkout/success/${order.id}`) },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message ?? REFUSED);
      setStep("declined");

      return;
    }

    /*
      `processing` counts as paid here because the money is already claimed: it is what an
      asynchronous method reports before it settles, and the order is marked paid on Stripe's own
      word rather than on this page's.
    */
    if (paymentIntent && ("succeeded" === paymentIntent.status || "processing" === paymentIntent.status)) {
      onPaid();

      return;
    }

    setMessage(REFUSED);
    setStep("declined");
  }

  return (
    <div data-payment-step={step} className="space-y-5">
      <div className="rounded-2xl border border-line bg-ink-950/60 p-4">
        <p className="text-sm font-medium text-ink-50">Card — a real payment through Stripe</p>

        <p className="mt-1 text-xs leading-relaxed text-ink-400">
          Test mode, so no real money moves. Use <span className="font-mono">4242 4242 4242 4242</span>{" "}
          to approve, <span className="font-mono">4000 0000 0000 0002</span> to be declined, or{" "}
          <span className="font-mono">4000 0025 0000 3155</span> to be asked for authentication. Any
          future expiry, any 3-digit code, any postcode. Your card details are typed into Stripe&rsquo;s
          own fields and go to Stripe, never to this site.
        </p>

        <form onSubmit={pay} className="mt-4 space-y-4">
          <PaymentElement options={{ layout: "tabs" }} />

          {message ? (
            <p
              role="alert"
              className="rounded-2xl border border-danger/40 bg-ink-900 px-4 py-3 text-sm text-danger"
            >
              {message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" size="lg" disabled={!stripe || "paying" === step}>
              {"paying" === step ? (
                "Waiting for Stripe…"
              ) : (
                <>
                  Pay <Price min={amount} max={amount} />
                </>
              )}
            </Button>

            <span className="text-xs text-ink-400">
              Order {order.number}: what WooCommerce priced it at.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
