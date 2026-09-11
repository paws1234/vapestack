import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms for using the Vapestack demo: ages 21 and over, and a shop that sells nothing.",
};

/**
 * Terms for a shop that sells nothing.
 *
 * The two things worth stating plainly are the age restriction, which is a real one, and the fact
 * that no sale occurs — which is what makes the rest of a normal terms page unnecessary rather than
 * omitted by accident.
 */
export default function TermsPage() {
  return (
    <InfoPage
      title="Terms of use"
      intro="A demo shop, for adults, with nothing for sale."
      updated="11 September 2026"
    >
      <h2>Age</h2>
      <p>
        This site shows and describes nicotine products. It is intended for adults aged{" "}
        <strong>21 or over</strong>, and the gate on entry is there for that reason. If you are under
        21, please leave.
      </p>

      <h2>Nothing is for sale</h2>
      <p>
        Vapestack is a demonstration. Every product is invented, every price is illustrative, and
        placing an order creates a record in a database and nothing else. No payment is taken, no
        goods are supplied, no delivery is arranged, and no contract of sale is formed — at any
        point, by any action you take here.
      </p>

      <h2>No warranty, and no promise it stays up</h2>
      <p>
        The site is provided as it is, for demonstration and portfolio purposes, with no warranty of
        any kind. It may be unavailable, it may change without notice, and the catalogue behind it
        may be reset — which will empty carts that refer to products which no longer exist.
      </p>

      <h2>Content and images</h2>
      <p>
        Product names, descriptions and imagery are placeholders invented for this demo and are not
        descriptions of any real product. Do not use anything here as product information or as
        health guidance of any kind.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Please do not use the checkout to submit abusive content, and please do not attempt to
        attack or overload the site. The order note field is stored verbatim in the database behind
        it.
      </p>
    </InfoPage>
  );
}
