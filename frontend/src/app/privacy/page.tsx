import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockContent } from "@/components/blocks/block-content";
import { InfoPage } from "@/components/layout/info-page";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { getPageBlocks } from "@/lib/wp/pages";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What the Vapestack demo stores: a cart and an age answer in your browser, the message you choose to send, and the order you place.",
};

/**
 * The privacy page, which has the advantage of being able to say almost nothing is collected.
 *
 * Its claims are now WordPress's copy, so they are editable - and that is a real responsibility
 * rather than a convenience: the two storage keys are in `lib/age-gate.ts` and `stores/cart.ts`, and
 * the app sets no cookies and loads no third-party script. **If a tracker is ever added, this page
 * has to change in WordPress**, and nothing in the code will remind anybody.
 */
export default async function PrivacyPage() {
  const blocks = await getPageBlocks("privacy");

  if (undefined === blocks) {
    return <OfflineNotice what="privacy page" />;
  }

  if (null === blocks) {
    notFound();
  }

  return (
    <InfoPage
      title="Privacy"
      intro="Two things live in your browser, and only what you type into a form is sent anywhere."
      updated="11 September 2026"
    >
      <BlockContent blocks={blocks} />
    </InfoPage>
  );
}
