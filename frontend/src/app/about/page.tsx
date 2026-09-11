import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Vapestack is: a headless storefront demo built on Next.js, WooCommerce and WPGraphQL.",
};

/**
 * What this site is, for a visitor who has noticed it is not quite a real shop.
 *
 * This is where the explanation of the stack belongs — it used to sit in the footer under every
 * page, where it was read as a shop telling customers about its own technology.
 */
export default function AboutPage() {
  return (
    <InfoPage
      title="About Vapestack"
      intro="A storefront demo, built to show a modern front end reading a real commerce backend."
      updated="11 September 2026"
    >
      <p>
        Vapestack is a portfolio project. The shop you are looking at is a Next.js application, and
        everything it shows — names, prices, stock, images — comes from a WooCommerce catalogue read
        over GraphQL at the moment you ask for it. Add something to the cart and check out, and a
        real order is created in that WooCommerce installation.
      </p>

      <h2>Why it looks like this</h2>
      <p>
        The point of the exercise is the split: WordPress does the commerce, and the front end is
        free to be quick and to look like whatever the brief asks for. There is no theme in charge of
        the storefront, no page builder between the catalogue and the screen, and no plugin deciding
        how a product grid should look.
      </p>

      <h2>What is real and what is not</h2>
      <ul>
        <li>The catalogue is real, and so are the orders the checkout writes.</li>
        <li>No payment is ever taken, and no payment provider is connected.</li>
        <li>Nothing ships, and no order email is sent — not even a confirmation.</li>
        <li>The products are invented, and the images are generated placeholders.</li>
      </ul>

      <h2>The boring parts, briefly</h2>
      <p>
        WooCommerce and WPGraphQL on the back, Next.js and Tailwind on the front, a persisted cart in
        the browser, and an order created through the WooCommerce REST API with a credential the
        browser never sees. The age gate and the cart both work without accounts, because there are
        no accounts.
      </p>
    </InfoPage>
  );
}
