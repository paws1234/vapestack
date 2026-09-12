import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockContent } from "@/components/blocks/block-content";
import { InfoPage } from "@/components/layout/info-page";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { getPageBlocks } from "@/lib/wp/pages";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "Vapestack does not ship anything: it is a demo storefront where no order is fulfilled.",
};

/**
 * Shipping and returns, answered honestly rather than with a policy nobody will follow.
 *
 * The words are WordPress's now, which is the right home for a policy: it is the kind of page a shop
 * changes without a deploy. The route, the metadata and the shell stay here.
 */
export default async function ShippingReturnsPage() {
  const blocks = await getPageBlocks("shipping-returns");

  if (undefined === blocks) {
    return <OfflineNotice what="shipping page" />;
  }

  if (null === blocks) {
    notFound();
  }

  return (
    <InfoPage
      title="Shipping & Returns"
      intro="Nothing ships, and there is nothing to return."
      updated="11 September 2026"
    >
      <BlockContent blocks={blocks} />
    </InfoPage>
  );
}
