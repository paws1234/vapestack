import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the person who built the Vapestack demo storefront.",
};

/**
 * How to get in touch.
 *
 * There is no form here on purpose. A form would need somewhere to send its message, and this demo
 * deliberately has no mail server, no CRM and no queue — a form that silently went nowhere would be
 * a worse answer than saying where to write.
 */
export default function ContactPage() {
  return (
    <InfoPage
      title="Contact"
      intro="This is a demo, but there is a real person behind it."
      updated="11 September 2026"
    >
      <p>
        Vapestack was built as a portfolio piece. If something here is broken, or you want to talk
        about how it was put together, the repository is the best place to look and the best place to
        say so.
      </p>

      <h2>What there is no one to ask about</h2>
      <ul>
        <li>
          <strong>Orders.</strong> A demo order is a row in a database on a laptop. It cannot be
          shipped, cancelled, refunded or chased.
        </li>
        <li>
          <strong>Stock.</strong> The catalogue is seeded from a script. Nothing is back-ordered.
        </li>
        <li>
          <strong>Your account.</strong> There are none. The cart lives in your own browser, and
          nothing here knows who you are.
        </li>
      </ul>

      <h2>There is deliberately no contact form</h2>
      <p>
        A form would have to post somewhere. Adding a mail provider to a demo that takes no orders
        and sends no email would be infrastructure for its own sake, so the contact details are the
        repository, and the honest answer to &ldquo;can you check on my order?&rdquo; is no.
      </p>
    </InfoPage>
  );
}
