import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockContent } from "@/components/blocks/block-content";
import { InfoPage } from "@/components/layout/info-page";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { getPageBlocks } from "@/lib/wp/pages";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms for using the Vapestack demo: ages 21 and over, and a shop that sells nothing.",
};

/**
 * Terms for a shop that sells nothing.
 *
 * Editable in WordPress now, like the other four. The age restriction it states is real and is
 * enforced by the gate in `components/age-gate.tsx`, which is code; the sentence that states it is
 * copy. Changing one without the other is the mistake this arrangement makes possible, so the two
 * are named together here.
 */
export default async function TermsPage() {
  const blocks = await getPageBlocks("terms");

  if (undefined === blocks) {
    return <OfflineNotice what="terms page" />;
  }

  if (null === blocks) {
    notFound();
  }

  return (
    <InfoPage
      title="Terms of use"
      intro="A demo shop, for adults, with nothing for sale."
      updated="11 September 2026"
    >
      <BlockContent blocks={blocks} />
    </InfoPage>
  );
}
