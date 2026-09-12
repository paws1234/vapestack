import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoOrderSummary } from "@/components/checkout/demo-order-summary";
import { OrderTimeline } from "@/components/checkout/order-timeline";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Price } from "@/components/ui/price";
import { getOrderSummary } from "@/lib/wp/rest";
import { startingStage } from "@/lib/order-timeline";
import { reconcileOrder } from "@/lib/stripe/settle";
import type { OrderSummary } from "@/lib/wp/types";
import { UpstreamUnavailableError } from "@/lib/wp/upstream";

/*
 * Read when the page is asked for: this follows an order that was created seconds ago, and a
 * prerendered answer would be one that no longer exists.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order placed",
  description: "The order Vapestack created in WooCommerce, and whether Stripe has been paid.",
};

type SuccessPageProps = {
  params: Promise<{ id: string }>;
};

/** The id the checkout redirects to when WooCommerce could not be reached at all. */
const DEMO_ID = "demo";

/**
 * Turns WooCommerce's status slug into something readable.
 *
 * @param status Status as WooCommerce sends it, e.g. `processing`.
 */
function readableStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, " ");
}

/**
 * The order that was just created.
 *
 * Reads the same trimmed summary the orders route returns, so there is one definition of what the
 * browser may know about an order rather than two.
 *
 * @param props.params Route parameters carrying the order id.
 */
export default async function CheckoutSuccessPage({ params }: SuccessPageProps) {
  const { id } = await params;

  /*
    Demo mode: no order was created, so there is nothing on the server to read. The receipt lives
    in the tab that placed it, which means the component that renders it has to be able to read
    storage.
  */
  if (DEMO_ID === id) {
    return <DemoOrderSummary />;
  }

  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId < 1) {
    notFound();
  }

  let order: OrderSummary | null;

  try {
    /*
      A card order may have been paid seconds ago without having been told so yet - a webhook is
      delivered on Stripe's schedule, not this page's - so the read asks Stripe about an order that
      is still waiting before this page decides what to say. One request, and only for a pending
      order.
    */
    order = await reconcileOrder(await getOrderSummary(orderId));
  } catch (error) {
    /*
      The order was created moments ago, so WordPress was reachable then. If it is not reachable
      now the order is not lost, only unreadable from here, and saying so beats an error page.
    */
    if (error instanceof UpstreamUnavailableError) {
      return <OfflineNotice what="order" />;
    }

    throw error;
  }

  if (!order) {
    notFound();
  }

  /*
    Three things a summary can be, and they are not interchangeable: a card that has been paid, a
    card that has not, and a simulated method that was never going to charge anything. Status alone
    cannot tell the last two apart - both are `processing` - so the recorded method is read as well.
  */
  const isCard = "stripe" === order.paymentMethod;
  const isPaid = isCard && ("processing" === order.status || "completed" === order.status);

  return (
    <Container width="narrow" className="py-10">
      <p className="text-sm font-medium text-neon-400">Order {order.number}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink-50 sm:text-4xl">
        {isPaid ? "Paid" : "Order placed"}
      </h1>

      {isPaid ? (
        <p className="mt-2 text-ink-200">
          Stripe took the card in <strong className="font-semibold text-ink-50">test mode</strong>,
          so no real money moved, and WooCommerce recorded the order as{" "}
          <span className="text-ink-50">{readableStatus(order.status)}</span>. No email was sent and
          nothing ships.
        </p>
      ) : isCard ? (
        <p className="mt-2 text-ink-200">
          WooCommerce has it as <span className="text-ink-50">{readableStatus(order.status)}</span>,
          which means the payment has not completed and nothing has been charged.{" "}
          <Link
            href="/checkout"
            className="text-ink-50 underline decoration-line underline-offset-4 transition hover:text-neon-400"
          >
            Back to the checkout
          </Link>{" "}
          to try another card.
        </p>
      ) : (
        <p className="mt-2 text-ink-200">
              WooCommerce recorded it as <span className="text-ink-50">{readableStatus(order.status)}</span>
              , under <span className="text-ink-50">{order.paymentTitle}</span>. That method is a
              simulation: nothing was charged, no email was sent and nothing ships.
            </p>
      )}

      <ul className="mt-8 divide-y divide-ink-800 rounded-3xl border border-ink-800 bg-ink-900 px-6">
        {order.items.map((line, index) => (
          <li key={`${line.name}-${index}`} className="flex items-start justify-between gap-4 py-4">
            <span className="min-w-0 text-ink-50">{line.name}</span>
            <span className="shrink-0 text-sm text-ink-400">× {line.quantity}</span>
            <Price min={line.total} max={line.total} className="shrink-0 text-ink-50" />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between rounded-3xl border border-ink-800 bg-ink-900 px-6 py-4">
        <span className="text-ink-200">Total</span>
        <Price min={order.total} max={order.total} className="text-lg font-semibold text-neon-400" />
      </div>

      {/*
        The timeline starts from the order's own status - a completed order starts at the end of
        the demonstration, a fresh one at the beginning - and the reviewer control moves a copy of
        the stage that lives in this browser. WooCommerce itself is never updated.
      */}
      <OrderTimeline orderId={String(order.id)} startStage={startingStage(order.status)} />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shop" className={buttonStyles("primary", "md")}>
          Back to the shop
        </Link>
        <Link href="/" className={buttonStyles("outline", "md")}>
          Home
        </Link>
      </div>
    </Container>
  );
}
