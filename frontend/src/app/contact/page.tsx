import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";
import { InfoPage } from "@/components/layout/info-page";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send a message, or email the person who built the Vapestack demo storefront.",
};

/**
 * How to get in touch.
 *
 * The form is real: it emails a real inbox, and the address is printed beside it because email is
 * just as good a route and does not depend on this deployment having a mail provider configured.
 *
 * There is still no message store, no CRM and no ticket queue behind the form. A message becomes an
 * email and nothing else, which is what the copy here promises and what `POST /api/contact` does.
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
        about how it was put together, send a message below or email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. That inbox is mine and I read it.
      </p>

      <h2>Send a message</h2>
      <p>
        Three fields, and it arrives as ordinary email. Your address is the reply-to, so replying to
        it answers you.
      </p>
      <ContactForm />

      <h2>What happens to a message</h2>
      <ul>
        <li>
          <strong>It is emailed to me.</strong> Straight to an inbox, as plain text, with no
          formatting for anything you type to be interpreted as.
        </li>
        <li>
          <strong>Nothing is stored.</strong> There is no table for it, no mailing list and no
          autoresponder — no ticket number will arrive, because there is no ticketing system. The
          message lives in my mail, and nowhere else.
        </li>
        <li>
          <strong>It is not a way to reach an order.</strong> Still, and unavoidably, there is no
          order to check on. See below.
        </li>
      </ul>

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
    </InfoPage>
  );
}
