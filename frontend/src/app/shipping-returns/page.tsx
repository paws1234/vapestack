import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "Vapestack does not ship anything: it is a demo storefront where no order is fulfilled.",
};

/**
 * Shipping and returns, answered honestly rather than with a policy nobody will follow.
 *
 * A real storefront needs a real policy here. This one needs to say that the question does not
 * arise, and to say what a policy would have to cover — which is more useful to a reader than a
 * paragraph of invented terms.
 */
export default function ShippingReturnsPage() {
  return (
    <InfoPage
      title="Shipping & Returns"
      intro="Nothing ships, and there is nothing to return."
      updated="11 September 2026"
    >
      <p>
        Vapestack is a demonstration storefront. When you place an order, a real record is created in
        the WooCommerce installation behind the site — and that is where it stops. No parcel is
        packed and no courier is booked; a card runs through Stripe in test mode, so the payment
        flow is real and the money is not.
      </p>

      <h2>What that means in practice</h2>
      <ul>
        <li>
          <strong>Delivery.</strong> There is none, to anywhere, ever. There is no delivery estimate
          to give you.
        </li>
        <li>
          <strong>Charges.</strong> None that are real. A card is taken through Stripe in test
          mode, so the card is validated and the order is marked paid while no money moves. QR
          payment and cash on delivery are simulations and record themselves as such.
        </li>
        <li>
          <strong>Returns.</strong> Nothing was sent, so nothing can come back.
        </li>
        <li>
          <strong>Order status.</strong> A simulated method records the order as <em>processing</em>{" "}
          at once, because for it there is nothing to wait for. A card order is recorded as{" "}
          <em>pending</em> and becomes <em>processing</em> only when Stripe confirms the payment —
          which a test card does in a few seconds.
        </li>
      </ul>

      <h2>What a real shop would have to cover</h2>
      <p>
        For anyone reading this as a template: a genuine policy would state who ships and to which
        regions, the delivery options and their timescales, who pays import duties, the age-check
        performed on delivery, and the cancellation window, condition and cost of a return — for
        nicotine products, including anything that cannot legally be returned once opened.
      </p>
    </InfoPage>
  );
}
