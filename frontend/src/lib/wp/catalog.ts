/**
 * Catalogue reads: the only place that knows the shape WordPress replies with.
 *
 * Everything here is server-side, so `publicUrl` can rewrite image origins before a
 * component ever sees them and no credential or internal URL reaches the browser.
 */

import { cache } from "react";
import { wpQuery } from "./graphql";
import { publicUrl } from "./publicUrl";
import { CATALOGUE_QUERY } from "./queries";
import type {
  Category,
  Product,
  ProductAttribute,
  ProductImage,
  ProductSpec,
  ProductVariation,
  StockStatus,
} from "./types";
import { UpstreamUnavailableError } from "./upstream";

type RawImage = { sourceUrl: string; altText: string | null } | null;

type RawAttribute = {
  name: string;
  label: string;
  options: string[];
  terms?: { nodes: { name: string; slug: string }[] };
};

type RawVariation = {
  databaseId: number;
  sku: string;
  price: string | null;
  stockStatus: string;
  image: RawImage;
  attributes: { nodes: { name: string; value: string }[] };
};

type RawProduct = {
  databaseId: number;
  name: string;
  slug: string;
  sku?: string | null;
  description: string | null;
  shortDescription: string | null;
  stockStatus: string;
  image: RawImage;
  productCategories: { nodes: { name: string; slug: string }[] };
  price?: string | null;
  attributes?: { nodes: RawAttribute[] };
  specs?: { nodes: { label: string; options: string[] }[] };
  variations?: { nodes: RawVariation[] };
};

type CatalogueData = { products: { nodes: RawProduct[] } };

/**
 * Converts a WordPress stock enum into the storefront's own two states.
 *
 * @param raw `IN_STOCK` or `OUT_OF_STOCK`.
 */
function toStockStatus(raw: string): StockStatus {
  return "IN_STOCK" === raw ? "in-stock" : "out-of-stock";
}

/**
 * Converts a raw price string into a number.
 *
 * @param raw Price as WordPress sends it, e.g. `"14.99"`.
 */
function toPrice(raw: string | null | undefined): number {
  if (!raw) {
    return 0;
  }

  const value = Number.parseFloat(raw);

  return Number.isFinite(value) ? value : 0;
}

/**
 * Maps an image onto the public origin.
 *
 * @param raw          Image as returned by WordPress.
 * @param fallbackAlt  Alt text to use when WordPress has none.
 */
function mapImage(raw: RawImage, fallbackAlt: string): ProductImage | null {
  const url = publicUrl(raw?.sourceUrl);

  if (!url) {
    return null;
  }

  return { url, alt: raw?.altText?.trim() || fallbackAlt };
}

/**
 * Maps an attribute, translating option slugs into their term labels.
 *
 * @param raw Attribute as returned by WordPress.
 */
function mapAttribute(raw: RawAttribute): ProductAttribute {
  const labels = new Map((raw.terms?.nodes ?? []).map((term) => [term.slug, term.name]));

  return {
    name: raw.name,
    label: raw.label,
    options: raw.options.map((slug) => ({ slug, label: labels.get(slug) ?? slug })),
  };
}

/**
 * Maps one variation of a variable product.
 *
 * @param raw Product name, used as image alt text when there is none.
 */
function mapVariation(raw: RawVariation, alt: string): ProductVariation {
  return {
    id: raw.databaseId,
    sku: raw.sku,
    price: toPrice(raw.price),
    stockStatus: toStockStatus(raw.stockStatus),
    image: mapImage(raw.image, alt),
    selection: Object.fromEntries(raw.attributes.nodes.map((a) => [a.name, a.value])),
  };
}

/**
 * Maps a product's specification attributes onto label/value pairs.
 *
 * A custom attribute's options are the values themselves rather than term slugs, so unlike
 * `mapAttribute` there is nothing to look up.
 *
 * @param raw Product as returned by WordPress.
 */
function mapSpecs(raw: RawProduct): ProductSpec[] {
  return (raw.specs?.nodes ?? [])
    .map((spec) => ({
      label: spec.label.trim(),
      value: spec.options.join(", ").trim(),
    }))
    .filter((spec) => spec.label !== "" && spec.value !== "");
}

/**
 * Maps a product, deriving the price range and availability WordPress does not give us.
 *
 * A variable product's own price field is a comma-joined list of variation prices, so the
 * range has to be computed here. Availability is the same problem: the parent reports itself
 * in stock while single combinations are sold out, so a product is only unavailable when
 * every variation is.
 *
 * @param raw Product as returned by WordPress.
 */
function mapProduct(raw: RawProduct): Product {
  const isVariable = raw.variations !== undefined;
  const variations = (raw.variations?.nodes ?? []).map((variation) => mapVariation(variation, raw.name));

  const prices = isVariable
    ? variations.map((variation) => variation.price)
    : (raw.price ?? "")
        .split(",")
        .map((part) => toPrice(part.trim()))
        .filter((price) => price > 0);

  return {
    id: raw.databaseId,
    name: raw.name,
    slug: raw.slug,
    sku: raw.sku?.trim() ?? "",
    description: raw.description ?? "",
    shortDescription: raw.shortDescription ?? "",
    category: raw.productCategories.nodes[0] ?? null,
    image: mapImage(raw.image, raw.name),
    price: {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
    },
    stockStatus: isVariable
      ? variations.some((variation) => "in-stock" === variation.stockStatus)
        ? "in-stock"
        : "out-of-stock"
      : toStockStatus(raw.stockStatus),
    specs: mapSpecs(raw),
    attributes: (raw.attributes?.nodes ?? []).map(mapAttribute),
    variations,
    type: isVariable ? "variable" : "simple",
  };
}

/**
 * Reads the whole catalogue, sorted by name.
 *
 * WordPress does not guarantee an order, so sorting happens here rather than in each page.
 *
 * `cache()` is per-request memoisation, not a longer-lived cache — the five-minute `revalidate`
 * in `graphql.ts` is what does that. It matters because `getCatalogue()` below reads the products
 * twice at once (`getCategories()` reads them too), so without this a single page render sends two
 * identical GraphQL requests.
 */
export const getProducts = cache(async (): Promise<Product[]> => {
  const data = await wpQuery<CatalogueData>(CATALOGUE_QUERY);

  return data.products.nodes
    .map(mapProduct)
    .sort((a, b) => a.name.localeCompare(b.name));
});

/**
 * Finds one product by its slug.
 *
 * Resolves from the catalogue rather than querying the product node directly: WordPress
 * answers an unknown slug with a GraphQL error as well as a null node, which would surface
 * as a 500 instead of a 404.
 *
 * @param slug Product slug, e.g. `neon-rush-6000`.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await getProducts();

  return products.find((product) => product.slug === slug) ?? null;
}

/** Lists the categories the catalogue actually uses, with product counts. */
export const getCategories = cache(async (): Promise<Category[]> => {
  const products = await getProducts();
  const categories = new Map<string, Category>();

  for (const product of products) {
    if (!product.category) {
      continue;
    }

    const existing = categories.get(product.category.slug);

    if (existing) {
      existing.productCount += 1;
    } else {
      categories.set(product.category.slug, { ...product.category, productCount: 1 });
    }
  }

  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
});

/** Everything a listing page needs, in one read. */
export type Catalogue = {
  categories: Category[];
  products: Product[];
};

/**
 * Reads the catalogue, or answers null when WordPress cannot be reached at all.
 *
 * Wrapped in `cache()` because it now has three readers in one render — the header's navigation,
 * the footer's shop column and the page itself — and each of them should not be a separate trip
 * to WordPress. The `null` contract below is unchanged by that, and callers still have to handle
 * it: WordPress is reached through a tunnel, and a closed tunnel is an expected state.
 *
 * The deployed demo reaches WordPress through a cloudflared tunnel that is only open while the
 * development machine is running, so "WordPress is not there" is an expected state rather than a
 * fault, and the pages answer it with an offline notice. A GraphQL error is still thrown: that
 * means the query or the catalogue is wrong, which is not something to paper over with a notice.
 */
export const getCatalogue = cache(async (): Promise<Catalogue | null> => {
  try {
    const [categories, products] = await Promise.all([getCategories(), getProducts()]);

    return { categories, products };
  } catch (error) {
    if (error instanceof UpstreamUnavailableError) {
      return null;
    }

    throw error;
  }
});
