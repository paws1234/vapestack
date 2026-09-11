#!/usr/bin/env node
/**
 * Fetches a small, reviewed set of product *facts* from a public WooCommerce Store API.
 *
 * The vapestack catalogue is seeded from `seed-products.php`. This script is the other way in: it
 * reads the Open Store API of an existing vape shop (read-only, no authentication, allowed by its
 * robots.txt), takes a handful of products, and writes them to a JSON fixture that
 * `import-source-products.php` turns into WooCommerce products.
 *
 * Two deliberate limits, both about what this script is *allowed* to produce:
 *
 * 1. It only ever asks for facts — id, name, slug, type, category, permalink and the structured
 *    spec attributes. It never requests `description` or `short_description`, so the marketing prose
 *    of another shop cannot end up in the fixture by accident. The storefront's copy is written by
 *    the importer instead.
 * 2. It records **one** image URL per product and nothing else about the images: no srcset, no
 *    thumbnails, no downloads. The URL has to be on the source origin, and the importer is what
 *    decides what to do with it — it copies the file into the media library so the shop serves its
 *    own copy, and falls back to a generated gradient when the file cannot be fetched.
 *
 * It is also polite: one request per category plus one for the product list, at least a second
 * apart, with an identifying User-Agent, and every response cached under `tools/.cache/` so a re-run
 * needs no network at all.
 *
 *   node tools/fetch-source-products.mjs                  # the three configured categories
 *   node tools/fetch-source-products.mjs --limit 6        # six products per category
 *   node tools/fetch-source-products.mjs --ids 35470,33225
 *   node tools/fetch-source-products.mjs --force          # overwrite an existing fixture
 *
 * The output is committed on purpose: it is what a person reviews before anything reaches
 * WooCommerce, and it is what makes the import reproducible when the source changes or disappears.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Where the reviewed fixture goes. Must be inside the theme: only that directory is mounted. */
const DEFAULT_OUT = path.join(
  PROJECT_DIR,
  "wp-content/themes/vapestack-theme/tools/data/source-products.json",
);

/** Raw responses, so a second run costs nothing. Gitignored. */
const CACHE_DIR = path.join(PROJECT_DIR, "tools/.cache/source");

const API = "https://vapeobservation.com/wp-json/wc/store/v1/products";

/** The only origin an image URL in the fixture is allowed to point at. */
const SOURCE_HOST = new URL(API).host;

/**
 * Identifying rather than anonymous, so the source can see who is reading and why.
 */
const USER_AGENT = "vapestack-demo-import/1.0 (+https://github.com/paws1234/vapestack)";

/** Politeness: milliseconds between requests. One category is one request. */
const DELAY_MS = 1500;

/**
 * The categories to read, and the price band each one's products get.
 *
 * The source has no prices of its own — every product it lists returns `prices.price: "0"` with
 * `is_purchasable: false`, because it is a specification catalogue rather than a priced shop. A
 * storefront cannot work without a price (the cart, the checkout, the sort control and the reward
 * ladder all read one), so the importer derives a stable demo price inside the band below. The
 * bands are here, next to the choice of category, rather than in the importer, because they are a
 * decision about the catalogue rather than about WooCommerce. Minor units, to match the Store API.
 */
const CATEGORIES = [
  { slug: "disposable-vape", name: "Disposable Vape", band: [999, 1499] },
  { slug: "vape-kit", name: "Vape Kit", band: [2499, 3999] },
  { slug: "e-liquids", name: "E-Liquids", band: [1299, 1999] },
  /*
   * Added when the catalogue became entirely real products: three more from each of two more
   * ranges. The limit is per category so the eleven products already in the shop keep their source
   * ids, and therefore their images, their prices and their SKUs.
   */
  { slug: "pod-cartridge", name: "Pod Cartridge", band: [699, 1199], limit: 3 },
  { slug: "vape-mod", name: "Vape Mod", band: [3499, 5999], limit: 3 },
];

/** Only these spec labels are kept, in this order, so a fixture reads the same every time. */
const SPEC_LABELS = [
  "Device Type",
  "Puff Count",
  "Puffs",
  "Battery",
  "Battery Capacity",
  "Capacity",
  "E-liquid Capacity",
  "Coil Type",
  "Nicotine",
  "Nicotine Strength",
  "Power Output",
  "Resistance",
];

/** Longest a single spec value may be before it is dropped as boilerplate rather than a value. */
const MAX_SPEC_LENGTH = 40;

/** How many spec lines one product may contribute. */
const MAX_SPECS = 6;

/** How many products to take from each category. */
const DEFAULT_LIMIT = 5;

const FIELDS = ["id", "name", "slug", "type", "categories", "attributes", "permalink", "images"].join(
  ",",
);

/** A failure that should end the run with a message rather than a stack trace. */
class FetchError extends Error {}

/**
 * Reads a WordPress Store API path, from the cache when it is already there.
 *
 * @param {string} url     Absolute URL to read.
 * @param {string} cacheAs File name to cache the body under.
 * @param {boolean} offline Skip the network entirely and answer from the cache.
 */
async function read(url, cacheAs, offline = false) {
  const cached = path.join(CACHE_DIR, cacheAs);

  if (existsSync(cached)) {
    const body = await readFile(cached, "utf8");
    console.log(`  cached   ${cacheAs}`);

    return JSON.parse(body);
  }

  if (offline) {
    throw new FetchError(`No cached copy at ${cacheAs} and --offline was passed.`);
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new FetchError(`${response.status} ${response.statusText} for ${url}`);
      }

      const body = await response.text();

      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(cached, body, "utf8");

      console.log(`  fetched  ${cacheAs}`);

      return JSON.parse(body);
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }

      console.warn(`  retrying after: ${error.message}`);
      await sleep(DELAY_MS * 2);
    }
  }
}

/** Waits, so two requests are never closer together than `DELAY_MS`. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Turns one Store API attribute into a spec line, or null when it is not worth keeping.
 *
 * The source's attributes are non-taxonomy spec attributes: `{name: "Battery", terms: [{name:
 * "1300 mAh"}]}`. They are facts about the device, which is exactly the part of that page this
 * import is allowed to keep.
 */
function toSpec(attribute) {
  const label = String(attribute?.name ?? "").trim();
  const value = (attribute?.terms ?? [])
    .map((term) => String(term?.name ?? "").trim())
    .filter(Boolean)
    .join(", ");

  if (!label || !value || value.length > MAX_SPEC_LENGTH) {
    return null;
  }

  return { label, value };
}

/**
 * Keeps the spec lines worth showing, in the order `SPEC_LABELS` names.
 *
 * The source also carries labels that restate the product name or its category ("Model", "Brand",
 * "Product Name"); those are dropped, because the product has a name and a category already.
 */
function toSpecs(product) {
  const wanted = new Map(SPEC_LABELS.map((label, index) => [label.toLowerCase(), index]));
  const seen = new Set();
  const specs = [];

  for (const attribute of product.attributes ?? []) {
    const spec = toSpec(attribute);

    if (!spec || seen.has(spec.label.toLowerCase()) || !wanted.has(spec.label.toLowerCase())) {
      continue;
    }

    seen.add(spec.label.toLowerCase());
    specs.push(spec);
  }

  return specs
    .sort((a, b) => wanted.get(a.label.toLowerCase()) - wanted.get(b.label.toLowerCase()))
    .slice(0, MAX_SPECS);
}

/**
 * The single image URL worth carrying over, or null when the product has none.
 *
 * Only the full-size original is taken. The source also publishes thumbnails, a srcset and a
 * sizes attribute; the storefront's own image optimiser generates whatever sizes the pages ask
 * for, so all of that would be redundant noise in a reviewed fixture.
 *
 * @param {object} product Source product as the Store API returned it.
 */
function imageOf(product) {
  const src = String(product?.images?.[0]?.src ?? "").trim();

  if (!src) {
    return null;
  }

  try {
    const url = new URL(src);

    return url.protocol === "https:" && url.host === SOURCE_HOST ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Builds the fixture entry for one source product, or null when it cannot be imported.
 *
 * A product is skipped rather than guessed at when it is not simple (its options would need the
 * whole variation plumbing) or when it carries no specs at all (the description is written from
 * them, and a page with neither prose nor specs is an empty product).
 */
function toEntry(product, category) {
  const name = String(product?.name ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name || product.type !== "simple") {
    return null;
  }

  const specs = toSpecs(product);

  if (specs.length === 0) {
    return null;
  }

  return {
    source_id: Number(product.id),
    name,
    source_slug: String(product.slug ?? ""),
    source_url: String(product.permalink ?? ""),
    image: imageOf(product),
    category: { slug: category.slug, name: category.name },
    price_band: category.band,
    specs,
  };
}

/** Reads the command line into options, rejecting anything unknown rather than guessing. */
function parseArgs(argv) {
  const options = { limit: DEFAULT_LIMIT, ids: [], force: false, offline: false, out: DEFAULT_OUT };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--force") {
      options.force = true;
    } else if (arg === "--offline") {
      options.offline = true;
    } else if (arg === "--limit") {
      options.limit = Number(argv[(index += 1)]);
    } else if (arg === "--ids") {
      options.ids = argv[(index += 1)]
        .split(",")
        .map((id) => Number(id.trim()))
        .filter(Boolean);
    } else if (arg === "--out") {
      options.out = path.resolve(argv[(index += 1)]);
    } else {
      throw new FetchError(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new FetchError("--limit must be a positive whole number.");
  }

  return options;
}

/**
 * The brand a product belongs to, as its first word.
 *
 * Used only to spread a category's picks across makers: the API answers in title order, which
 * arrives as a block of one brand's products, and a shop page showing five products from the same
 * maker reads as a single-brand catalogue rather than a range.
 */
function brandOf(entry) {
  return entry.name.split(/\s+/)[0].toLowerCase();
}

/**
 * Takes `limit` entries, round-robining between brands so every maker is represented before any
 * gets a second product. Deterministic: brands are visited in name order.
 */
function spreadByBrand(entries, limit) {
  const byBrand = new Map();

  for (const entry of entries) {
    const brand = brandOf(entry);

    if (!byBrand.has(brand)) {
      byBrand.set(brand, []);
    }

    byBrand.get(brand).push(entry);
  }

  const queues = [...byBrand.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, items]) => items);
  const picked = [];

  while (picked.length < limit && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      if (picked.length >= limit) {
        break;
      }

      const next = queue.shift();

      if (next) {
        picked.push(next);
      }
    }
  }

  return picked.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Reads one category's products and turns them into fixture entries.
 *
 * Products that cannot be imported are skipped *without* consuming the limit — otherwise a category
 * whose first few products are variable, or carry no specs, would come back short for no visible
 * reason.
 */
async function readCategory(category, options) {
  const listUrl =
    `${API}?category=${encodeURIComponent(category.slug)}` +
    `&per_page=100&page=1&orderby=title&order=asc&_fields=${FIELDS}`;

  const products = await read(listUrl, `category-${category.slug}.json`, options.offline);

  if (!Array.isArray(products)) {
    throw new FetchError(`Expected a list of products for ${category.slug}.`);
  }

  const usable = products.map((product) => toEntry(product, category)).filter(Boolean);
  const entries = spreadByBrand(usable, category.limit ?? options.limit);

  console.log(
    `  ${category.slug}: ${entries.length} kept, ${products.length - usable.length} skipped, ` +
      `${products.length} listed`,
  );

  return entries;
}

/**
 * Reads specific products by id, whatever their category.
 *
 * Used when the shortlist is chosen by hand. The category has to be read off each response, and one
 * that is not in `CATEGORIES` still gets a price band so the importer has one to work with.
 */
async function readIds(ids, options) {
  const url = `${API}?include=${ids.join(",")}&per_page=100&_fields=${FIELDS}`;
  const products = await read(url, `include-${ids.join("-")}.json`, options.offline);

  return products
    .map((product) => {
      const source = product.categories?.[0];
      const known = CATEGORIES.find((category) => category.slug === source?.slug);
      const category = known ?? {
        slug: source?.slug ?? "imported",
        name: source?.name ?? "Imported",
        band: [999, 3999],
      };

      return toEntry(product, category);
    })
    .filter(Boolean);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (existsSync(options.out) && !options.force) {
    throw new FetchError(
      `${path.relative(PROJECT_DIR, options.out)} already exists. Review it, then pass --force to ` +
        "replace it — the committed fixture is the record of what was imported.",
    );
  }

  console.log(options.ids.length > 0 ? "Reading products by id" : "Reading categories");

  const entries = [];

  if (options.ids.length > 0) {
    entries.push(...(await readIds(options.ids, options)));
  } else {
    for (const category of CATEGORIES) {
      entries.push(...(await readCategory(category, options)));

      if (category !== CATEGORIES[CATEGORIES.length - 1]) {
        await sleep(DELAY_MS);
      }
    }
  }

  if (entries.length === 0) {
    throw new FetchError("Nothing usable came back. Re-run without --offline, or pick another id.");
  }

  // The whole point of the fixture is that it holds facts, one image URL per product, and nothing
  // else. These assertions are what keep that true if the source's shape ever changes.
  //
  // The pattern is deliberately narrow: an earlier version looked for a dot followed by three or
  // four alphanumerics, which is a file extension often enough to be tempting and wrong often
  // enough to matter - it reads "3.0mL" as an asset URL and refuses a perfectly good fixture.
  for (const entry of entries) {
    const { image, ...facts } = entry;

    if (/wp-content|\.(?:jpe?g|png|webp|gif|avif)\b/i.test(JSON.stringify(facts))) {
      throw new FetchError(`Fixture entry ${entry.source_id} carries an asset URL outside its image.`);
    }

    if (image !== null && !image.startsWith(`https://${SOURCE_HOST}/wp-content/uploads/`)) {
      throw new FetchError(
        `Fixture entry ${entry.source_id} points its image somewhere other than ${SOURCE_HOST}.`,
      );
    }
  }

  entries.sort((a, b) => a.category.slug.localeCompare(b.category.slug) || a.name.localeCompare(b.name));

  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(options.out, `${JSON.stringify(entries, null, 2)}\n`, "utf8");

  console.log(`\nWrote ${entries.length} products to ${path.relative(PROJECT_DIR, options.out)}`);

  for (const entry of entries) {
    const specs = entry.specs.map((spec) => `${spec.label}=${spec.value}`).join(" | ");
    console.log(`  ${String(entry.source_id).padStart(6)}  ${entry.category.slug.padEnd(16)} ${entry.name}`);
    console.log(`          ${specs}`);
    console.log(`          image: ${entry.image ? entry.image.split("/").pop() : "(none listed)"}`);
  }

  console.log("\nReview the fixture, then import it:");
  console.log("  wpdev wp eval-file wp-content/themes/vapestack-theme/tools/import-source-products.php");
}

main().catch((error) => {
  console.error(`\nfetch-source-products: ${error.message}`);
  process.exitCode = 1;
});
