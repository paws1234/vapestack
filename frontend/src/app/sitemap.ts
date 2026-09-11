import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { getCatalogue } from "@/lib/wp/catalog";

/**
 * `/sitemap.xml`.
 *
 * Two halves. The static routes are listed always, from a constant, so the file is real even with
 * WordPress unreachable. The catalogue routes are read at request time, which is what
 * `force-dynamic` below asks for — the build must not fetch WordPress for anything, and a sitemap
 * that did would be the one file in the app that broke that rule.
 *
 * A closed tunnel means the catalogue half is simply absent rather than a failed build: WordPress
 * being away is an expected state in this app, and a sitemap listing every route it cannot
 * describe right now is more useful than no sitemap.
 */

/** Route the sitemap may be rendered per request rather than prerendered at build time. */
export const dynamic = "force-dynamic";

/** Routes that exist without the catalogue. */
const STATIC_ROUTES = [
  "/",
  "/shop",
  "/about",
  "/contact",
  "/shipping-returns",
  "/privacy",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.5,
  }));

  const catalogue = await getCatalogue();

  if (!catalogue) {
    return staticEntries;
  }

  const categoryEntries: MetadataRoute.Sitemap = catalogue.categories.map((category) => ({
    url: absoluteUrl(`/shop/${category.slug}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const productEntries: MetadataRoute.Sitemap = catalogue.products.map((product) => ({
    url: absoluteUrl(`/product/${product.slug}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
