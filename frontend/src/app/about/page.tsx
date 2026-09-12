import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockContent } from "@/components/blocks/block-content";
import { InfoPage } from "@/components/layout/info-page";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { getPageBlocks } from "@/lib/wp/pages";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Vapestack is: a headless storefront demo built on Next.js, WooCommerce and WPGraphQL.",
};

/**
 * What this site is, for a visitor who has noticed it is not quite a real shop.
 *
 * The words are no longer in this file. They live in WordPress, on the page with the slug `about`,
 * where they are edited in the block editor - see `docs/blocks-plan.md`, and
 * `wp-content/themes/vapestack-theme/tools/seed-pages.php` for the copy as it was first written.
 * This file keeps what is code: the route, the metadata, the shell and the two failures.
 *
 * The shell matters as much as the read. `InfoPage` renders the `h1`, the intro and the "last
 * updated" line, and hands the body to `Prose`; so a page's title and its summary are still code
 * while its body is content. That is the split the plan chose, not an oversight.
 */
export default async function AboutPage() {
  const blocks = await getPageBlocks("about");

  /* Null is "no such page" and has to stay a 404; undefined is "WordPress is away". */
  if (undefined === blocks) {
    return <OfflineNotice what="about page" />;
  }

  if (null === blocks) {
    notFound();
  }

  return (
    <InfoPage
      title="About Vapestack"
      intro="A storefront demo, built to show a modern front end reading a real commerce backend."
      updated="11 September 2026"
    >
      <BlockContent blocks={blocks} />
    </InfoPage>
  );
}
