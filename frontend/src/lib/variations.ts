/**
 * Choosing a variation from the customer's selections.
 *
 * Plain functions over the shapes in `types.ts`, deliberately outside `lib/wp/`: that folder
 * reads `WP_GRAPHQL_URL` and `WP_INTERNAL_URL`, so importing anything from it would drag the
 * server-only WordPress transport into the browser bundle.
 *
 * Everything here is deterministic. The same product and the same selection always resolve to
 * the same variation, which is what lets the prerendered markup and the first client render
 * agree and keeps the console free of hydration warnings.
 */

import type { Product, ProductOption, ProductVariation } from "@/lib/wp/types";

/** The option chosen for each attribute, keyed by taxonomy name, e.g. `{ pa_flavour: "frost-mint" }`. */
export type Selection = Record<string, string>;

/** A single option that would make the current selection buyable. */
type Alternative = {
  /** Taxonomy name of the attribute to change. */
  attribute: string;
  /** The option of that attribute that works. */
  option: ProductOption;
};

/**
 * Whether a variation is the one the selection describes.
 *
 * Both sides have to agree on the same attributes: a variation that declares fewer (or more)
 * attributes than were chosen is a different combination, not a match. WordPress sends the
 * taxonomy name as the key and the option slug as the value, so this compares slugs.
 *
 * @param variation Variation as mapped from the catalogue.
 * @param selection Option chosen per attribute.
 */
export function matchesSelection(variation: ProductVariation, selection: Selection): boolean {
  const names = Object.keys(variation.selection);

  if (names.length !== Object.keys(selection).length) {
    return false;
  }

  return names.every((name) => variation.selection[name] === selection[name]);
}

/**
 * Resolves a selection to the variation it describes, if the product has one.
 *
 * @param product   Product whose variations are searched.
 * @param selection Option chosen per attribute.
 */
export function findVariation(product: Product, selection: Selection): ProductVariation | null {
  return product.variations.find((variation) => matchesSelection(variation, selection)) ?? null;
}

/**
 * The selection the page starts on.
 *
 * An available combination, so the page shows a price and "In stock" before anything is clicked.
 * Ties are broken by id after an explicit sort because WordPress does not guarantee an order.
 *
 * @param product Product to pick a starting combination for.
 */
export function initialSelection(product: Product): Selection {
  const ordered = [...product.variations].sort((a, b) => a.id - b.id);
  const preferred = ordered.find((variation) => "in-stock" === variation.stockStatus) ?? ordered[0];

  if (!preferred) {
    return {};
  }

  const selection: Selection = {};

  for (const attribute of product.attributes) {
    const chosen = preferred.selection[attribute.name] ?? attribute.options[0]?.slug;

    if (chosen) {
      selection[attribute.name] = chosen;
    }
  }

  return selection;
}

/**
 * Whether an option still leads to something buyable, given every other choice.
 *
 * This is what lets the selectors say "sold out" about the combination in front of the customer
 * instead of letting them pick it and wonder.
 *
 * @param product       Product whose variations are searched.
 * @param selection     Option chosen per attribute.
 * @param attributeName Attribute the option belongs to.
 * @param optionSlug    Option being offered, which replaces the current choice for that attribute.
 */
export function isOptionAvailable(
  product: Product,
  selection: Selection,
  attributeName: string,
  optionSlug: string,
): boolean {
  const candidate = { ...selection, [attributeName]: optionSlug };

  return product.variations.some(
    (variation) => "in-stock" === variation.stockStatus && matchesSelection(variation, candidate),
  );
}

/**
 * The sentence to show about the current combination, or null when it is buyable.
 *
 * A sold-out combination is never silently accepted or quietly swapped for a working one: the
 * selection stands, and this explains it and names an option that would work.
 *
 * @param product   Product being viewed.
 * @param selection Option chosen per attribute.
 */
export function unavailableMessage(product: Product, selection: Selection): string | null {
  if (product.attributes.length === 0) {
    return null;
  }

  const variation = findVariation(product, selection);

  if (variation && "in-stock" === variation.stockStatus) {
    return null;
  }

  if (!product.variations.some((candidate) => "in-stock" === candidate.stockStatus)) {
    return "Every option of this product is sold out.";
  }

  const combination = product.attributes
    .map((attribute) => optionLabel(product, attribute.name, selection[attribute.name]))
    .filter((label) => label.length > 0)
    .join(" · ");

  const problem = variation ? `${combination} is sold out` : `${combination} is not available`;
  const alternative = findAlternative(product, selection);

  return alternative
    ? `${problem} — ${alternative.option.label} is available.`
    : `${problem}.`;
}

/**
 * The labels of the chosen options, in attribute order.
 *
 * This is what a cart line shows under the product name, so it has to be the readable label
 * ("Frost Mint · 3mg") rather than the taxonomy name and slug it was resolved from.
 *
 * @param product   Product being viewed.
 * @param selection Option chosen per attribute.
 */
export function chosenOptionLabels(product: Product, selection: Selection): string[] {
  return product.attributes
    .map((attribute) => optionLabel(product, attribute.name, selection[attribute.name]))
    .filter((label) => label.length > 0);
}

/**
 * Picks the change that gets to something buyable in the fewest ways.
 *
 * Holding the other choices fixed, each attribute is asked which of its other options work. The
 * attribute with the fewest working options wins, because that is the one where the alternative
 * is unambiguous; ties go to the attribute order in the catalogue.
 *
 * @param product   Product being viewed.
 * @param selection Option chosen per attribute.
 */
function findAlternative(product: Product, selection: Selection): Alternative | null {
  let best: (Alternative & { count: number }) | null = null;

  for (const attribute of product.attributes) {
    const working = attribute.options.filter(
      (option) =>
        option.slug !== selection[attribute.name] &&
        isOptionAvailable(product, selection, attribute.name, option.slug),
    );

    if (working.length > 0 && (best === null || working.length < best.count)) {
      best = { attribute: attribute.name, option: working[0], count: working.length };
    }
  }

  return best;
}

/**
 * The label of one option, falling back to the slug WordPress sent.
 *
 * @param product       Product the attribute belongs to.
 * @param attributeName Taxonomy name of the attribute.
 * @param slug          Option slug, or undefined when nothing is chosen.
 */
function optionLabel(product: Product, attributeName: string, slug: string | undefined): string {
  if (!slug) {
    return "";
  }

  const attribute = product.attributes.find((candidate) => candidate.name === attributeName);

  return attribute?.options.find((option) => option.slug === slug)?.label ?? slug;
}
