/**
 * The search index, as data and arithmetic.
 *
 * Pure and framework-free. The catalogue is read once by `app/layout.tsx` for the navigation, and
 * the **same read** is flattened into this index on the server; the browser gets the index and
 * nothing else. No fetch, no route handler, no build-time catalogue access, and no dependency — six
 * products and about thirty entries do not need a fuzzy-matching library, and a plain
 * `Array.filter`-shaped scan is instant at this size.
 *
 * **The payload is deliberately slim.** `description` and `shortDescription` are HTML authored in
 * WordPress; sending them to every page to power a search over titles would balloon the RSC payload
 * for no gain. An entry is `{ kind, slug, name, range, options }` and nothing more.
 */

import type { Category, Product } from "@/lib/wp/types";

/** What a result is. Shown, and used to break ties. */
export type SearchEntryKind = "product" | "range" | "option";

/**
 * One searchable thing.
 *
 * `options` carries whichever list makes the entry findable by the words a visitor would type:
 *
 * - a **product** lists every option label it can be bought in, so "mint" finds it;
 * - an **option** lists the product it belongs to, so the result can say which one that is;
 * - a **range** has none.
 */
export type SearchEntry = {
  kind: SearchEntryKind;
  /** Product slug, or category slug for a range. */
  slug: string;
  /** The line a visitor reads and matches against. */
  name: string;
  /** Range name, or null when the product has no category. */
  range: string | null;
  options: string[];
};

/** A result: the entry, where it goes and how well it matched. */
export type SearchResult = SearchEntry & {
  href: string;
  /** Lower is better. Only used for ordering. */
  score: number;
};

/** Where following a result goes. One definition, used by the dialog and its keys. */
export function entryHref(entry: SearchEntry): string {
  return "range" === entry.kind ? `/shop/${entry.slug}` : `/product/${entry.slug}`;
}

/**
 * Flattens the catalogue into the index the browser searches.
 *
 * @param products   Products from the layout's own catalogue read.
 * @param categories Ranges, from the same read.
 */
export function buildSearchIndex(products: Product[], categories: Category[]): SearchEntry[] {
  const ranges: SearchEntry[] = categories.map((category) => ({
    kind: "range",
    slug: category.slug,
    name: category.name,
    range: category.name,
    options: [],
  }));

  const entries: SearchEntry[] = [];
  /* Several products share an option label ("Frost Mint"), so the same option is one result. */
  const seenOptions = new Set<string>();

  for (const product of products) {
    const optionLabels = product.attributes.flatMap((attribute) =>
      attribute.options.map((option) => option.label),
    );

    entries.push({
      kind: "product",
      slug: product.slug,
      name: product.name,
      range: product.category?.name ?? null,
      options: optionLabels,
    });

    for (const label of optionLabels) {
      const key = `${product.slug}:${label.toLowerCase()}`;

      if (seenOptions.has(key)) {
        continue;
      }

      seenOptions.add(key);

      entries.push({
        kind: "option",
        slug: product.slug,
        name: label,
        range: product.category?.name ?? null,
        options: [product.name],
      });
    }
  }

  return [...ranges, ...entries];
}

/** How well one entry matches, or null when it does not. */
function scoreEntry(entry: SearchEntry, query: string): number | null {
  const name = entry.name.toLowerCase();

  if (name === query) {
    return 0;
  }

  if (name.startsWith(query)) {
    return 1;
  }

  if (name.split(/\s+/).some((word) => word.startsWith(query))) {
    return 2;
  }

  if (name.includes(query)) {
    return 3;
  }

  if (entry.options.some((option) => option.toLowerCase().includes(query))) {
    return 4;
  }

  if (entry.range?.toLowerCase().includes(query)) {
    return 5;
  }

  return null;
}

/** Kind order for ties, so a product beats a range beats an option at the same score. */
const KIND_ORDER: Record<SearchEntryKind, number> = { product: 0, range: 1, option: 2 };

/** How many results the dialog shows. Enough to choose from, few enough to scan. */
export const MAX_RESULTS = 8;

/**
 * Filters the index by a typed query.
 *
 * A substring match over a lowercased string, ranked so that a name that *starts* with what was
 * typed comes before one that merely contains it, and a product's own name beats one of its
 * options. An empty query matches nothing: the dialog shows its hint instead of a wall of results.
 *
 * @param entries The index, from {@link buildSearchIndex}.
 * @param query   What has been typed.
 * @param limit   Most results to return.
 */
export function searchCatalogue(
  entries: SearchEntry[],
  query: string,
  limit: number = MAX_RESULTS,
): SearchResult[] {
  const needle = query.trim().toLowerCase();

  if ("" === needle) {
    return [];
  }

  const matches: SearchResult[] = [];

  for (const entry of entries) {
    const score = scoreEntry(entry, needle);

    if (null !== score) {
      matches.push({ ...entry, href: entryHref(entry), score });
    }
  }

  return matches
    .sort(
      (a, b) =>
        a.score - b.score ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}
