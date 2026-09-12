import Image from "next/image";
import type { ReactNode } from "react";
import { ContactForm } from "@/components/contact/contact-form";
import { buttonStyles } from "@/components/ui/button";
import {
  REFUSED_BLOCKS,
  blockName,
  buttonsIn,
  childrenOf,
  headingLevel,
  imageFrom,
  listIsOrdered,
  listItems,
  shortcodeText,
  spacerHeight,
  textOf,
  type WpBlock,
} from "@/lib/wp/blocks";

/**
 * The table: WordPress block name to React. **One line to add a block.**
 *
 * The drawing is deliberately classless wherever it can be. `InfoPage` hands its body to `Prose`,
 * which styles `h2`, `h3`, `ul`, `ol`, `a` and `strong` as *descendants*, so a renderer that emits
 * plain `<p>`, `<h2>` and `<li>` is already wearing the site's type - and no component in this
 * repository has to change to make a page editable. The exceptions are the few blocks with no
 * semantic element to inherit from: a rule, a stretched image, a row of columns, a row of buttons.
 * Those carry classes, and the classes come from the design system rather than from new Tailwind.
 *
 * Anything not in this table is drawn as its children, so a block this site has never met - the
 * editor's latest, a plugin's block, `core/missing` from a disabled plugin - contributes what is
 * inside it instead of blanking the page. `core/html` is the one block that is refused outright.
 *
 * Keyed by `core/...` because that is what `block.name` holds; `block.type` (`CoreParagraph`) is the
 * plugin's own name for the same thing and is not used here.
 */
const BLOCKS: Record<string, (block: WpBlock, key: string) => ReactNode> = {
  /*
    Body copy. The HTML is inline formatting only - `<strong>`, `<em>`, `<a>` - written by this
    site's own administrator in the block editor, which is the same trust the product descriptions
    already render under in `product-notes.tsx`.
  */
  "core/paragraph": (block, key) => {
    const text = textOf(block);

    /* An empty paragraph is a paragraph an editor has not written yet. Drawing it would put a blank
       line in the page; drawing nothing leaves the page as the author last left it. */
    return text === "" ? null : <p key={key} dangerouslySetInnerHTML={{ __html: text }} />;
  },

  "core/heading": (block, key) => {
    const text = textOf(block);

    if (text === "") {
      return null;
    }

    return 3 === headingLevel(block) ? (
      <h3 key={key} dangerouslySetInnerHTML={{ __html: text }} />
    ) : (
      <h2 key={key} dangerouslySetInnerHTML={{ __html: text }} />
    );
  },

  "core/list": (block, key) => {
    const items = listItems(block);

    if (items.length === 0) {
      return null;
    }

    const entries = items.map((item, index) => (
      <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
    ));

    return listIsOrdered(block) ? <ol key={key}>{entries}</ol> : <ul key={key}>{entries}</ul>;
  },

  /*
    A quote. `Prose` styles no `blockquote`, so this one carries its own rule and indent rather than
    arriving as a browser-default indent that matches nothing else on the page.
  */
  "core/quote": (block, key) => {
    const citation = (block.attributes?.citation ?? "").trim();
    const text = textOf(block);

    return (
      <blockquote key={key} className="border-l-2 border-line pl-4">
        {childrenOf(block).length > 0 ? (
          <BlockContent blocks={childrenOf(block)} />
        ) : (
          <p dangerouslySetInnerHTML={{ __html: text }} />
        )}
        {citation === "" ? null : <cite className="mt-2 block text-sm text-ink-400 not-italic">{citation}</cite>}
      </blockquote>
    );
  },

  "core/separator": (_block, key) => <hr key={key} className="border-ink-800" />,

  /* A spacer is the one place an editor's own number is used, and only when it is a CSS length. */
  "core/spacer": (block, key) => {
    const height = spacerHeight(block);

    return height === null ? null : <div key={key} aria-hidden className="shrink-0" style={{ height }} />;
  },

  /*
    An image the editor chose from the media library. `next/image` because that is how every other
    photograph on this site is served - WordPress's own file, optimised on the way out - and because
    the intrinsic dimensions compiled into the markup are what stop the page jumping as it loads.
  */
  "core/image": (block, key) => {
    const image = imageFrom(block);

    if (image === null) {
      return null;
    }

    const picture = (
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes="(min-width: 768px) 640px, 100vw"
        className="h-auto w-full rounded-2xl border border-ink-800"
      />
    );

    return (
      <figure key={key}>
        {image.href === null ? (
          picture
        ) : (
          <a href={image.href} className="block">
            {picture}
          </a>
        )}
        {image.caption === null ? null : (
          <figcaption className="mt-2 text-sm text-ink-400">{image.caption}</figcaption>
        )}
      </figure>
    );
  },

  /*
    A row of buttons. The first is the row's primary action and the rest are outlined, which is the
    same shape the hand-written heroes use: one thing to press, and alternatives beside it. The
    styles come from `buttonStyles`, so a block button and a coded button cannot drift apart.
  */
  "core/buttons": (block, key) => {
    const buttons = buttonsIn(block);

    if (buttons.length === 0) {
      return null;
    }

    return (
      <div key={key} className="flex flex-wrap gap-3">
        {buttons.map((button, index) => (
          <a
            key={index}
            href={button.href}
            className={buttonStyles(0 === index ? "primary" : "outline", "md")}
            {...(button.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
          >
            {button.text}
          </a>
        ))}
      </div>
    );
  },

  /*
    Columns. The editor's own widths are ignored on purpose: the site has one content width, and a
    two-up grid that stacks below `sm` is the only arrangement any existing page uses.
  */
  "core/columns": (block, key) => (
    <div key={key} className="grid gap-6 sm:grid-cols-2">
      {childrenOf(block).map((column, index) => (
        <div key={index}>
          <BlockContent blocks={childrenOf(column)} />
        </div>
      ))}
    </div>
  ),

  /* A group is the editor's own container: draw what is in it, decide nothing about how. */
  "core/group": (block, key) => (
    <div key={key}>
      <BlockContent blocks={childrenOf(block)} />
    </div>
  ),

  /*
    The contact form.

    The one part of these pages that is a component rather than words. It sits in the page as a
    shortcode block, so the editor can see where it is and move it, and any *other* shortcode is
    refused: this site does not run shortcodes, and drawing an unknown one as text would put
    `[something]` in front of a visitor.
  */
  "core/shortcode": (block, key) => {
    const text = shortcodeText(block);

    return CONTACT_FORM_SHORTCODE === text ? <ContactForm key={key} /> : null;
  },
};

/**
 * The shortcode that means "the contact form goes here".
 *
 * Seeded by `wp-content/themes/vapestack-theme/tools/seed-pages.php` in place of the `<ContactForm />`
 * the contact page used to hold between its paragraphs.
 */
const CONTACT_FORM_SHORTCODE = "[vapestack_contact_form]";

/**
 * Draws a page's worth of blocks.
 *
 * **This returns a fragment, not a wrapper element, and that is load-bearing.** `Prose` spaces its
 * children with `[&>*+*]:mt-4`, which is a child selector; a `<div>` here would hide every block
 * from it and the page would lose the rhythm every other page has.
 *
 * @param props.blocks Blocks as `getPageBlocks()` returned them, in document order.
 */
export function BlockContent({ blocks }: { blocks: WpBlock[] }) {
  return <>{blocks.map((block, index) => draw(block, `block-${index}`))}</>;
}

/**
 * One block: the table, or its children, or nothing.
 *
 * @param block Block as GraphQL returned it.
 * @param key React key, derived from the block's position so the tree is stable between renders.
 */
function draw(block: WpBlock, key: string): ReactNode {
  const name = blockName(block);

  if (REFUSED_BLOCKS.has(name)) {
    return null;
  }

  const draw = BLOCKS[name];

  if (draw !== undefined) {
    return draw(block, key);
  }

  /* Unknown, or a block whose plugin is no longer installed. Its children are still content. */
  return <BlockContent key={key} blocks={childrenOf(block)} />;
}
