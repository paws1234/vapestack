import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * `/robots.txt`.
 *
 * Everything is disallowed on purpose. This is a portfolio demo reached through a development
 * machine's tunnel, and pointing a crawler at a shop with invented products, no checkout and an
 * intermittent origin is not doing anyone a favour. The sitemap is published anyway so that the
 * file is a complete statement of the site's policy rather than a half one, and so the routes are
 * enumerable if the decision is ever reversed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
