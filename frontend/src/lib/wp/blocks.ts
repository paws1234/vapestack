/**
 * Reading Gutenberg blocks out of GraphQL, without React.
 *
 * This module knows one thing: how `wpengine/wp-graphql-content-blocks` shapes a block. It is pure
 * so the drawing half can stay a drawing half, and so the awkward parts of the transport - an
 * attribute that is a string here and a number there, a quote whose text arrives as a child block,
 * a heading with six levels and a design with two - are answered once, in one place.
 *
 * The transport, as `docs/blocks-tasks.md` records it (B1):
 *
 * - the field is `editorBlocks`, on the page, **not** `contentBlocks`;
 * - `attributes` is not on the `EditorBlock` interface, so the query carries one inline fragment per
 *   supported block and an unsupported block arrives with `attributes` simply absent;
 * - `name` is the block's registered name (`core/paragraph`), `type` is the plugin's own type name
 *   (`CoreParagraph`), and both are nullable.
 *
 * Nothing here throws on unexpected input. A page's copy is content, not code: an editor may insert
 * something this site has never seen, and the renderer's answer is to draw its children rather than
 * to fail the request.
 */

/** The union of the attributes the query asks for, across every supported block. */
export type WpBlockAttributes = {
  /** Paragraph, heading and list-item copy. Inline HTML, from this site's own administrator. */
  content?: string | null;
  /** A quote's text. Only used when the quote has no child paragraphs of its own. */
  value?: string | null;
  /** A quote's attribution. */
  citation?: string | null;
  /** A heading's level, 1-6. WordPress types it as a float. */
  level?: number | null;
  /** Whether a list is numbered. */
  ordered?: boolean | null;
  /** A list's raw inner HTML, used only when the list has no list-item children. */
  values?: string | null;
  /*
    Three fields are aliased in the query, and these are the aliases. WordPress types a spacer's
    `height` as `String!` and an image's as `String`, and GraphQL refuses to answer both under one
    name - so the aliases are what make the query valid, and the side effect is that `spacerHeight`
    and `imageWidth` say what they are rather than leaving one word to mean two things.
  */
  /** A spacer's height, e.g. `32px`. */
  spacerHeight?: string | null;
  /** An image's intrinsic width, as the block recorded it. */
  imageWidth?: string | null;
  /** An image's intrinsic height. */
  imageHeight?: string | null;
  /** A button's destination. */
  url?: string | null;
  /** A button's label. */
  text?: string | null;
  /** `_blank` when the editor asked for a new tab. */
  linkTarget?: string | null;
  /** An image's source. */
  src?: string | null;
  /** An image's alternative text. WordPress types it non-null. */
  alt?: string | null;
  /** An image's caption. */
  caption?: string | null;
  /** The destination an image was linked to. */
  href?: string | null;
};

/** One block, as GraphQL returns it. `innerBlocks` is nested unless the query asked for `flat`. */
export type WpBlock = {
  name?: string | null;
  type?: string | null;
  /**
   * How WordPress itself renders this block.
   *
   * Used for one thing: a `core/shortcode` block written the way the block editor writes it carries
   * no `text` attribute at all - measured, `attributes.text` is `null` while this is
   * `<p>[vapestack_contact_form]</p>`. See `shortcodeText()`.
   */
  renderedHtml?: string | null;
  attributes?: WpBlockAttributes | null;
  /** Present on image blocks: the media item's own dimensions, which beat the block's. */
  mediaDetails?: { width?: number | null; height?: number | null } | null;
  innerBlocks?: WpBlock[] | null;
};

/** Blocks whose children are drawn and whose own attributes never are. */
export const TRANSPARENT_BLOCKS = new Set([
  "core/group",
  "core/columns",
  "core/column",
  "core/buttons",
  "core/quote",
  "core/list",
  "core/list-item",
]);

/**
 * Blocks this site refuses to draw at all.
 *
 * `core/html` exists to put arbitrary markup into a page. Everything else here arrives from the
 * block editor, which constrains what can be written; this one does not, and it is the only block
 * an editor could use to put a `<script>` into the storefront. It renders nothing, and the editor
 * sees the block sitting in WP-Admin with nothing on the page - visible, not silent.
 */
export const REFUSED_BLOCKS = new Set(["core/html"]);

/** The block's registered name, or an empty string when WordPress did not send one. */
export function blockName(block: WpBlock): string {
  return (block.name ?? "").trim();
}

/** The block's children, always an array. */
export function childrenOf(block: WpBlock): WpBlock[] {
  return block.innerBlocks ?? [];
}

/**
 * The shortcode a `core/shortcode` block holds, however WordPress chose to store it.
 *
 * Two shapes exist and both have to work. When the attribute is written into the block's own JSON
 * (`<!-- wp:shortcode {"text":"[foo]"} -->`) it arrives as `attributes.text`. When the block is
 * written the way the editor actually writes it - `<!-- wp:shortcode -->[foo]<!-- /wp:shortcode -->` -
 * there is no attribute at all, because `core/shortcode` declares `text` with `source: "html"` and a
 * source-based attribute is not serialised back into the comment. The shortcode is then only readable
 * from `renderedHtml`, which still carries it because nothing on this site registers that shortcode.
 *
 * @param block A block, of any kind.
 */
export function shortcodeText(block: WpBlock): string {
  const attribute = (block.attributes?.text ?? "").trim();

  if (attribute !== "") {
    return attribute;
  }

  return (block.renderedHtml ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A block's inline HTML, which is where paragraphs, headings and list items keep their words. */
export function textOf(block: WpBlock): string {
  return (block.attributes?.content ?? block.attributes?.value ?? "").trim();
}

/**
 * A heading's level, squeezed into the two the design has.
 *
 * WordPress offers six; `Prose` styles `h2` and `h3`, and the page's own `h1` belongs to `InfoPage`.
 * So an author's "Heading" and "Heading 1" are both drawn as `h2`, and anything deeper as `h3`,
 * rather than letting an unstyled `h4` arrive at browser default size in the middle of the page.
 */
export function headingLevel(block: WpBlock): 2 | 3 {
  const level = Number(block.attributes?.level ?? 2);

  return Number.isFinite(level) && level >= 3 ? 3 : 2;
}

/** Whether a list is numbered. */
export function listIsOrdered(block: WpBlock): boolean {
  return block.attributes?.ordered === true;
}

/**
 * A list's items as inline HTML.
 *
 * Modern WordPress stores each item as a `core/list-item` child; the older shape kept the whole
 * list in the `values` attribute. Both are read, in that order, because a page written years ago
 * and a page written today both have to render.
 */
export function listItems(block: WpBlock): string[] {
  const fromChildren = childrenOf(block)
    .filter((child) => "core/list-item" === blockName(child))
    .map(textOf)
    .filter((item) => item !== "");

  if (fromChildren.length > 0) {
    return fromChildren;
  }

  return (block.attributes?.values ?? "")
    .split("</li>")
    .map((item) => item.replace(/<[^>]+>/g, "").trim())
    .filter((item) => item !== "");
}

/** A button as the storefront will draw it. */
export type BlockButton = {
  text: string;
  href: string;
  external: boolean;
};

/** The buttons inside a `core/buttons` group. */
export function buttonsIn(block: WpBlock): BlockButton[] {
  return childrenOf(block)
    .filter((child) => "core/button" === blockName(child))
    .map((child) => ({
      text: (child.attributes?.text ?? "").trim(),
      href: (child.attributes?.url ?? "").trim(),
      external: "_blank" === child.attributes?.linkTarget,
    }))
    .filter((button) => button.text !== "" && button.href !== "");
}

/** An image, ready to hand to `next/image`. */
export type BlockImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string | null;
  href: string | null;
};

/** A positive integer, or null when the string is not one. */
function positiveInt(value: unknown): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

/**
 * An image block, or null when it has no source.
 *
 * The media item's own dimensions are preferred over the block's, because the block records the size
 * the author *chose* while the media item records what the file actually is - and passing the wrong
 * numbers to `next/image` is how an image arrives stretched or letter-boxed.
 */
export function imageFrom(block: WpBlock): BlockImage | null {
  const src = (block.attributes?.src ?? "").trim();

  if (src === "") {
    return null;
  }

  const width = positiveInt(block.mediaDetails?.width) ?? positiveInt(block.attributes?.imageWidth) ?? 1200;
  const height = positiveInt(block.mediaDetails?.height) ?? positiveInt(block.attributes?.imageHeight) ?? 800;
  const caption = (block.attributes?.caption ?? "").trim();
  const href = (block.attributes?.href ?? "").trim();

  return {
    src,
    /* WordPress keeps the alt text beside the image rather than on it. An empty one is honest: a
       decorative image with no alt is better than the file name read aloud. */
    alt: (block.attributes?.alt ?? "").trim(),
    width,
    height,
    caption: caption === "" ? null : caption,
    href: href === "" ? null : href,
  };
}

/** A spacer's height, and only when it is a length rather than a sentence. */
const LENGTH = /^\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)$/;

/** The height a spacer asks for, or null when it is not a length this site will put in a style. */
export function spacerHeight(block: WpBlock): string | null {
  const height = (block.attributes?.spacerHeight ?? "").trim();

  return LENGTH.test(height) ? height : null;
}

/**
 * Whether a block is one the renderer has a drawing for.
 *
 * The list is exported for the check in `docs/blocks-tasks.md` B2, which asserts that every block in
 * the plan's table has one and that the rest fall through to the unknown case.
 */
export const DRAWN_BLOCKS = new Set([
  "core/paragraph",
  "core/heading",
  "core/list",
  "core/quote",
  "core/separator",
  "core/spacer",
  "core/image",
  "core/buttons",
  "core/columns",
  "core/group",
]);
