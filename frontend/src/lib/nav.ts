/**
 * How the header and the footer group the catalogue's ranges.
 *
 * One rule in one place: the two surfaces are styled differently — the header's menu is a floating
 * card, the footer's expands in place — but they must not disagree about which ranges are the
 * hardware shelf, and neither should need an edit when the catalogue gains a range.
 *
 * Framework-free, like `lib/product-sort.ts`, so a server component (the footer) can call it
 * without pulling a client module into the tree.
 */

import type { Category } from "@/lib/wp/types";

/** The label the grouped ranges sit behind. */
export const GROUP_LABEL = "Vape";

/**
 * Matched on the name rather than a hard-coded list of slugs, because ranges are derived from the
 * catalogue: the hardware shelf is exactly the ranges that read "Vape <thing>", and a tenth one
 * arriving tomorrow belongs in the same group without an edit here.
 */
const GROUP_PATTERN = /^vape\s/i;

/**
 * Splits ranges into the ones a surface lists and the ones it groups.
 *
 * @param categories Ranges as the catalogue derives them, in catalogue order.
 */
export function splitRanges(categories: Category[]): { inline: Category[]; grouped: Category[] } {
  const inline: Category[] = [];
  const grouped: Category[] = [];

  for (const category of categories) {
    (GROUP_PATTERN.test(category.name) ? grouped : inline).push(category);
  }

  return { inline, grouped };
}
