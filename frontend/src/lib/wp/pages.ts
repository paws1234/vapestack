/**
 * The five pages whose copy is edited in WordPress, read as blocks.
 *
 * A sibling of `catalog.ts` rather than a part of it: the catalogue is a product read with a
 * five-minute cache and paging behind it, and a page is one document. What they share is the
 * transport, the two-outcome convention, and the rule that a WordPress that is away is a designed
 * state rather than an exception.
 */

import { cache } from "react";
import type { WpBlock } from "./blocks";
import { wpQuery } from "./graphql";
import { PAGE_BLOCKS_QUERY } from "./queries";
import { UpstreamUnavailableError } from "./upstream";

/** What the page query returns. */
type PageBlocksData = {
  page: { title: string; editorBlocks: WpBlock[] | null } | null;
};

/**
 * One page's blocks, or null when there is no such page, or **undefined** when WordPress could not
 * be reached at all.
 *
 * The two failures are kept apart on purpose, because they lead to different pages: a slug the
 * catalogue does not have is a 404 and has to stay one, while a shop that is away is the offline
 * notice. An unknown URI answers `page: null` with no GraphQL error, so the distinction is real
 * rather than guessed.
 *
 * Wrapped in `cache()` for the same reason the catalogue is: the layout, the header and the page all
 * render in one request, and this must cost one read between them.
 *
 * **Read fresh, not from the five-minute data cache.** An editor changes a paragraph and reloads the
 * site, and the change has to be there; that is the entire point of moving these pages into
 * WordPress. A cached answer would have hidden edits for minutes at a time while looking like the
 * save had failed. `revalidate: 0` is what makes the cache opt-in per read rather than a property of
 * the transport.
 *
 * @param slug Page slug, which is also its URI: `about` is asked for as `/about/`.
 */
export const getPageBlocks = cache(
  async (slug: string): Promise<WpBlock[] | null | undefined> => {
    let data: PageBlocksData;

    try {
      data = await wpQuery<PageBlocksData>(
        PAGE_BLOCKS_QUERY,
        { uri: `/${slug}/` },
        { revalidate: 0 },
      );
    } catch (error) {
      if (error instanceof UpstreamUnavailableError) {
        return undefined;
      }

      throw error;
    }

    if (null === data.page) {
      return null;
    }

    return data.page.editorBlocks ?? [];
  },
);
