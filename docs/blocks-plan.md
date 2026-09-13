# Plan: Vapestack — the site's own words, edited in WordPress as blocks

Written **2026-09-12**, against the code as it stands at commit `4eeaf19` ("restore things"). It
follows `docs/stripe-plan.md` in shape. The owner's brief, in one line: *"Your backend stays entirely
in WordPress, you get a visual block-based editor built right into WP-Admin, and your Next.js app
just maps those blocks to React components. Register all blocks in Next.js components, but as much
as possible don't touch Next.js components code."*

To turn this into tasks: `plan docs/blocks-plan.md`, or ask for a task by id from
`docs/blocks-tasks.md` once it exists. The plan is the source and is never edited; the task file is
the record.

## Goal

Five pages currently hold their copy as **JSX in this repository** — `/about`, `/contact`, `/privacy`,
`/shipping-returns`, `/terms`. After this work that copy lives in **WordPress**, is edited in the
**Block Editor** with the mouse, and is read back by Next.js as **structured block data** which a new
renderer maps to React. Editing a paragraph in WP-Admin and reloading the page shows the change.

The mapping is the deliverable, not the fetching: a table of WordPress block → React element that
covers the core blocks an editor can insert, lives in one file, and is extended by adding one line.
An unknown block renders its own inner blocks rather than breaking the page, so an editor cannot
take a page down by inserting something the renderer has not met.

Existing components are **not rewritten**. The seam is deliberate: `InfoPage` already passes its body
copy unclassed into `Prose`, so a renderer emitting plain `<p>`, `<h2>`, `<ul>` and `<blockquote>`
inherits today's styling exactly. The page files change from holding copy to holding a read; the
components they use do not change at all.

## What is actually there today

Measured, not assumed:

- **The five pages are 59–81 lines each and are pure JSX prose**, every one of them
  (`app/{about,contact,privacy,shipping-returns,terms}/page.tsx`). Each wraps copy in
  `components/layout/info-page.tsx`, which renders `Container` → `h1` + intro + "Last updated" →
  `Prose` → a link back to the shop.
- **`InfoPage`'s docblock says the opposite of this plan**: *"These pages are static text about the
  demo itself, so they read the catalogue for nothing and render with WordPress stopped — which is
  the point of putting them here rather than in WordPress."* This plan reverses that decision, and
  the cost is named under **The hard parts**.
- **`Prose` styles descendants, not the wrapper** — that is why the renderer can emit unclassed
  semantic HTML and still match the current look. `components/ui/prose.tsx` is the file that decides
  this, and is out of scope.
- **WordPress is 7.1 with `wp-graphql` 2.22.3**, WooCommerce 11.1.0, Elementor 4.3.0-beta2.
- **Two candidate plugins, and only one is alive.** As wordpress.org reports, neither is in the
  plugin directory (`{"error":"Plugin not found."}` for both slugs), so both are GitHub installs:
  - `pristas-peter/wp-graphql-gutenberg` — last release **v0.4.1, 2022-12-05**; its README says
    *"Requires wp-graphql 0.9.0+"*, which is the 1.x era; 65 open issues. Against WPGraphQL 2.22.3
    this is a rewrite behind, and its own docs describe blocks the plugin no longer tracks.
  - `wpengine/wp-graphql-content-blocks` — **v4.8.6, 2026-07-06**, pushed **2026-09-09**, GPL-2.0,
    149 stars, maintained by the WPGraphQL maintainers. Its README: *"This plugin is an extension of
    wp-graphql, so make sure you have it installed first … There is no other configuration needed"*.
    This is the one.
- **`wp-content/plugins/` is not bind-mounted.** The compose file mounts exactly three things: the
  kit's shared `wp-agent-bridge`, `wp-content/themes/${PROJECT_THEME}`, and `wp-content/uploads`.
  Core and any wp-cli-installed plugin live in the `wp_data` **volume**, which survives restarts but
  is invisible to git and to a fresh clone.
- **The kit's own pattern for a GitHub plugin is `cache/packages/*.zip` plus
  `setup-site.sh:84`** (`wp plugin install "/opt/packages/${plugin}.zip" --activate`), and
  `mcp-adapter.zip` is there for exactly this reason. Both files are kit files.
- **`wp-content/themes/vapestack-theme/` is tracked in git**, including `tools/seed-products.php` and
  `tools/import-source-products.php`. The project's seeding lives there.
- The container reaches `github.com` and `wordpress.org` (both 200).

## Decisions

1. **`wpengine/wp-graphql-content-blocks`, pinned to v4.8.6.** Not the plugin named in the brief:
   it targets WPGraphQL 1.x and last shipped in 2022, and the brief's own reasoning — "instead of
   Elementor, which doesn't output cleanly to headless APIs" — is satisfied just as well by the
   maintained one.
2. **Installed into the project, not the kit's cache.** `wpdev add plugin` already creates a project
   plugin directory and a bind mount for it; the release is unpacked into that directory. A small
   `tools/install-blocks-plugin.sh` pins the version and re-does it, so the vendor code is **not**
   committed as a pile of files, and this stays reversible by deleting one mounted directory.
3. **Core blocks only, mapped to semantic elements.** The renderer's table is the feature. No
   Elementor, no custom block types, no block patterns, no `theme.json` work.
4. **The renderer emits unclassed HTML inside `Prose`.** That is what keeps "don't touch the
   components" literally true and the pages looking identical. Where a block has no sensible
   unclassed form — columns, buttons — the renderer uses Tailwind classes that already exist in the
   design system (`buttonStyles` for buttons) rather than new ones.
5. **An unknown block is not an error.** It renders its children; if it has none, it renders
   nothing. A page must never 500 because an editor inserted a block the renderer has not met.
6. **WordPress is the source of truth for this copy**, which means these five pages stop working
   when the tunnel is closed. That is the reversal named above; the mitigation is the same one every
   other route uses — `OfflineNotice` — not a second copy of the text in code.
7. **Seeding goes in the theme's `tools/`,** next to `seed-products.php`, and writes the current copy
   as blocks so the editor opens on real content rather than an empty canvas.

## The block map

The table the brief asks for. `core/` names are as WordPress stores them in `post_content`.

| WordPress block | React output | why |
| --- | --- | --- |
| `core/paragraph` | `<p>` | inline HTML kept (`<strong>`, `<a>`, `<em>`), so an editor gets real formatting |
| `core/heading` | `<h2>`–`<h4>` by `level` | `h1` is demoted to `h2`: `InfoPage` owns the page's only `h1` |
| `core/list` | `<ul>` / `<ol>` by `ordered` | |
| `core/list-item` | `<li>` | |
| `core/quote` | `<blockquote>` | `citation` becomes a nested `<cite>` |
| `core/separator` | `<hr>` | |
| `core/image` | `<figure>` + `next/image` | `alt`, `width`, `height` come from the media item |
| `core/buttons` → `core/button` | `<a className={buttonStyles(...)}>` | reuses the existing button styles, no new ones |
| `core/columns` → `core/column` | `<div className="grid …">` | two-up on `sm` up, stacked below |
| `core/group` | `<div>` | the editor's own container, style attributes ignored |
| `core/spacer` | `<div style={{ height }}>` | the one place an editor's number is used directly |
| *(anything else)* | its inner blocks | never a crash, never a blank page |
| `core/html` | **nothing** | raw HTML from an editor is the one thing this site does not render |

## Steps

### Phase 0 — the plugin is in and the schema is known
Install v4.8.6 into a project plugin directory, activate it, and **probe** the schema rather than
assuming the field name: query one page for its blocks and record the exact shape (field name, how
attributes arrive, what an unrendered block looks like).

### Phase 1 — the renderer
`lib/wp/blocks.ts` (types + the mapping table + a normaliser) and `components/blocks/block-content.tsx`
(the component tree). Pure and testable from a fixture: the renderer must be provably correct before
any page depends on it.

### Phase 2 — seed the five pages
A `tools/seed-pages.php` in the theme, idempotent by slug, writing today's copy as blocks — every
paragraph, heading and list item. Run it, then read the five pages back over GraphQL and compare the
**text** with the current pages: nothing may be lost in the move.

### Phase 3 — the pages read blocks
Each of the five page files keeps its `metadata` and its `InfoPage` shell and replaces its JSX body
with the read. `contact` keeps its form component untouched and takes only its prose from blocks.

### Phase 4 — the round trip, proved
Edit a paragraph in the Block Editor, reload the Next.js page, see the edit. Then the sweep: three
widths, the four prose pages plus `contact`, and the offline case.

## The hard parts, named so they are not discovered late

- **The cost of the reversal.** These five pages were the only ones that rendered with WordPress
  stopped. They will not any more. That is a real regression in one axis, accepted in exchange for
  the editor; it is called out here so it is a decision rather than a surprise, and the offline
  behaviour is verified explicitly in Phase 4.
- **Inline HTML is a trust boundary.** A paragraph's `content` is HTML. It comes from this site's own
  administrator through the block editor, which is the same trust model the product descriptions
  already render under (`dangerouslySetInnerHTML` in `product-notes.tsx` and `product-detail.tsx`).
  `core/html` is refused outright, because that block exists to paste *anything*.
- **Block attributes are not uniform.** Paragraphs carry `content`; headings carry `content` *and*
  `level`; images carry an `id` plus a `mediaItem` shape; buttons carry `url`, `text` and
  `linkTarget`; lists carry `ordered`. The renderer normalises first, then maps — guessing per block
  inline is how a renderer becomes unreadable.
- **Images arrive from the tunnel, whose hostname changes every session.** The build bakes the
  current host into `images.remotePatterns`, which is the same trap that made deployed photographs
  disappear before. Block images inherit it, and the page must degrade to a tile rather than a broken
  icon for the same reason.
- **`post_content` is not the page as rendered.** Gutenberg stores blocks in the post's content and
  the plugin parses them; a block that is registered by a plugin which is later disabled parses as
  `core/missing` (or as its raw content). The renderer's "unknown → children" rule covers this case
  deliberately.
- **Two sources of the same words drift.** After seeding, the JSX copy is deleted from the page
  files. Leaving it "just in case" is how a site ends up with two truths.

## Constraints / Out of scope

- **Do not change** `components/layout/info-page.tsx`, `components/ui/prose.tsx`,
  `components/ui/container.tsx`, `components/ui/button.tsx`, `components/contact/contact-form.tsx`,
  or anything in the cart, checkout, Stripe, catalogue or WordPress transport paths. If a component
  needs a new prop, the plan is wrong — change the renderer instead.
- **Do not touch `~/Desktop/dev/wp-kit/`** — no cache zips, no `setup-site.sh`, no image changes.
- **No new npm dependency, and no new Composer dependency in the plugin's direction.**
- **Not in scope:** making `/`, `/shop` or product pages block-driven; Elementor anywhere; custom
  blocks; block patterns; `theme.json`; a preview endpoint; menu/footer editing; per-page metadata
  from WordPress (`metadata` stays in the page files, because it is code).
- The plugin's own editor features that this site does not use — media library sync, rich-text
  reuse — are not to be wired up "while we are in there".

## Done when

- The five pages render the same words they render today, read from WordPress as blocks.
- Editing a paragraph in WP-Admin changes the page on reload, with no deploy and no code change.
- The renderer's table covers every block the seeded pages use, plus the core set above; an inserted
  unknown block leaves the page intact.
- `npx tsc --noEmit`, `npm run lint` and `npm run build` are clean, and the offline case is a
  designed state rather than a stack trace.
- The install is reproducible: `tools/install-blocks-plugin.sh` on a fresh project produces the same
  plugin version.

## Verification

- **Schema probe** (`B1`): the GraphQL query and its JSON response, pasted into the task file.
- **Renderer** (`B2`): a fixture with every mapped block *and* two unmapped ones, rendered and read
  back through the DOM — the same method the UI work in this repo uses.
- **Move** (`B3`): the text of each page before and after, compared mechanically, with the counts of
  paragraphs, headings and list items on both sides.
- **Round trip** (`B4`): a paragraph edited in the block editor through the WordPress REST API, seen
  on the Next.js page, then reverted.
- **Sweep** (`B5`): three widths (1440x900, 768x1024, 390x844) with `file` confirming each PNG's
  dimensions, the offline case with WordPress stopped, and `wpdev smoke` after it is back.

## Origin

The owner's brief, pasted into the session on 2026-09-12:

> **WordPress Gutenberg via WPGraphQL (If you want to keep WordPress)** — Is it free? Yes, entirely
> free and open-source since you already have WordPress running behind your GraphQL setup. What you
> get: instead of using Elementor (which doesn't output cleanly to headless APIs), you use the
> native WordPress Block Editor (Gutenberg). By installing the `WPGraphQL Gutenberg` plugin,
> WordPress turns blocks (columns, covers, paragraphs, buttons) into clean JSON/GraphQL data. Why it
> fits: your backend stays entirely in WordPress, you get a visual block-based editor built right
> into WP-Admin, and your Next.js app just maps those blocks to React components. Register all blocks
> in Next.js components but as much as possible don't touch Next.js components code.
