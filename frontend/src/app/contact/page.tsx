import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockContent } from "@/components/blocks/block-content";
import { InfoPage } from "@/components/layout/info-page";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { getPageBlocks } from "@/lib/wp/pages";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send a message, or email the person who built the Vapestack demo storefront.",
};

/**
 * How to get in touch.
 *
 * The prose is WordPress's, like its four siblings. The **form is not**: it is the one thing on these
 * pages that is behaviour rather than words, so it stays a component and the page holds a shortcode
 * block in the place it belongs. The renderer draws `[vapestack_contact_form]` as `<ContactForm />`
 * and refuses every other shortcode, so a visitor can never be shown `[something]` as text.
 *
 * The email address is the one wart of the move: it is written into the copy, which means changing it
 * is an edit in WordPress and not a change to `lib/site.ts`. The footer and the API route still read
 * the constant, so the two have to be changed together.
 */
export default async function ContactPage() {
    const blocks = await getPageBlocks("contact");

    if (undefined === blocks) {
        return <OfflineNotice what="contact page" />;
    }

    if (null === blocks) {
        notFound();
    }

  return (
    <InfoPage
      title="Contact"
      intro="This is a demo, but there is a real person behind it."
      updated="11 September 2026"
    >
          <BlockContent blocks={blocks} />
    </InfoPage>
  );
}
