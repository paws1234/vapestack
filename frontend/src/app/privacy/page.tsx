import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What the Vapestack demo stores: a cart and an age answer in your browser, and the order you choose to place.",
};

/**
 * The privacy page, which has the advantage of being able to say almost nothing is collected.
 *
 * Every claim here is checked against the code before it is made: the two storage keys are in
 * `lib/age-gate.ts` and `stores/cart.ts`, the order is the only thing that leaves the browser, and
 * the app sets no cookies and loads no third-party script. If a tracker is ever added, this page is
 * the first thing that has to change.
 */
export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy"
      intro="Two things live in your browser, and one thing is sent to the shop."
      updated="11 September 2026"
    >
      <p>
        This is a demonstration storefront, and it collects as close to nothing as a shop that takes
        orders can. There is no analytics, no advertising, no third-party script and no cookie. No
        account is created, and nothing here knows who you are between visits.
      </p>

      <h2>What is stored in your browser</h2>
      <ul>
        <li>
          <strong>Your cart.</strong> The items, with the options you chose, under the key{" "}
          <code>vapestack-cart</code>. It is there so a reload does not empty your basket. Clearing
          your browser storage clears it.
        </li>
        <li>
          <strong>Your age answer.</strong> A single value, under the key{" "}
          <code>vapestack-age-verified</code>, so the gate does not ask again on every page. The
          footer has a control that forgets it.
        </li>
      </ul>

      <h2>What leaves your browser</h2>
      <p>
        One thing: when you submit the checkout, the items in your cart and the billing details you
        typed are sent to this site&apos;s own server, which creates a WooCommerce order with them.
        That order stores the name, email, address and note you entered, in the same database as the
        catalogue. It is a demo order and nothing is done with it — but it is a real record, so type
        nothing you would not want sitting in a WordPress database.
      </p>

      <h2>What is not collected</h2>
      <ul>
        <li>No analytics, no session recording, no advertising identifiers.</li>
        <li>No IP address is stored by the application.</li>
        <li>No payment details, because no payment is ever taken.</li>
        <li>No account, no password, and no profile.</li>
      </ul>

      <h2>Removing what is there</h2>
      <p>
        Clearing site data for this domain removes the cart and the age answer from your browser. A
        demo order created through the checkout can be deleted from the site&apos;s WordPress admin,
        which is where it lives.
      </p>
    </InfoPage>
  );
}
