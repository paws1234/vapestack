# Tasks: Vapestack — the site's own words, edited in WordPress as blocks

From `docs/blocks-plan.md`, written 2026-09-12 against commit `4eeaf19`. The plan file is the source
and is **never edited**; the checklist and the evidence live here.

Any single task can be run on its own in a fresh session by asking for it by id, for example:
`do B2 of docs/blocks-tasks.md`. Each task carries its own context, what it may touch, what proves it,
and how it is verified — so a session needs this file and the repository, nothing else.

| # | Task | Plan id | Size | Depends on |
| --- | --- | --- | --- | --- |
| B1 | The content-blocks plugin is installed, pinned, and its schema is known | Phase 0 | S | — |
| B2 | The block renderer and its mapping table | Phase 1 | M | B1 (for the shape, not to start) |
| B3 | The five pages are seeded into WordPress as blocks | Phase 2 | M | B1 |
| B4 | The five pages read their blocks, and the JSX copy is deleted | Phase 3 | M | B2, B3 |
| B5 | The round trip is proved, and the sweep | Phase 4 | M | B4 |

**Parallelism.** B2 can be written against the fixture before B3 lands: it needs `B1` only to know
what a block object looks like, so start it as soon as `B1`'s probe is in this file. B3 needs the
plugin and nothing else. B4 is strictly after B2 and B3. B5 is last. Nothing here may run against the
checkout, the cart, Stripe or the catalogue.

## Definition of done for the whole plan

- The five pages (`/about`, `/contact`, `/privacy`, `/shipping-returns`, `/terms`) render the words
  they render today, read from WordPress as structured blocks, with the JSX copy deleted from the
  page files.
- A paragraph edited in WP-Admin shows on the page after a reload — no deploy, no code change.
- An unknown block, a `core/html` block and a `core/missing` block all leave the page intact.
- Nothing in `components/layout/info-page.tsx`, `components/ui/prose.tsx`, `components/ui/container.tsx`,
  `components/ui/button.tsx`, `components/contact/contact-form.tsx`, the cart, the checkout, Stripe or
  the WordPress transport is modified. `git diff --stat` proves it.
- `npx tsc --noEmit`, `npm run lint` and `npm run build` are clean.
- `~/Desktop/dev/wp-kit/` is untouched.

## Constraints every task inherits

- **WordPress:** the `vapestack` project only, port **8889**, through `wpdev wp …`. Never `sudo`,
  never a hand-edit of the database, never a change to another project.
- **The kit is read-only.** No file under `~/Desktop/dev/wp-kit/` may be created, edited or deleted.
- **No new npm dependency.** Any new runtime dependency makes the task wrong.
- **The frontend runs on port 3002** for verification (`npx next start -p 3002` after
  `npm run build`), because 3000 is what the local kit's `SITE_URL` assumes and is often taken.
- **Measure, do not eyeball.** Layout claims come from the DOM (`getBoundingClientRect`,
  `innerText`, `scrollWidth`) and screenshots are confirmed with `file` for real dimensions.
- **A page must never 500 because of content.** Every new read has a designed failure state.

## Shared commands

```bash
# the shop and the plugin
wpdev status                      # from the project dir; containers and ports
wpdev wp plugin list --status=active
wpdev wp post list --post_type=page --fields=ID,post_name,post_status
wpdev wp eval 'echo get_post( 2 )->post_content;'

# the frontend
cd frontend && npx tsc --noEmit && npm run lint && npm run build
npx next start -p 3002            # production build for anything visual

# a GraphQL question, without the IDE
curl -s -X POST http://localhost:8889/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ page(id: \"/about/\", idType: URI) { title } }"}'
```

Playwright is not a project dependency. Use the cached copy:
`NODE_PATH=/home/adminpaws/.npm/_npx/705bc6b22212b352/node_modules` with the bundled Chromium at
`~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`, and answer the age gate before the
first paint by putting `"true"` in `localStorage["vapestack-age-verified"]`.

---

### B1 — The content-blocks plugin is installed, pinned, and its schema is known — `[x]` done

**Goal** — `wpengine/wp-graphql-content-blocks` v4.8.6 is active in the local WordPress, installed
through a project plugin directory so a recreate does not lose it, and one page's blocks can be read
over GraphQL with the response pasted below.

**Depends on** none. **Parallel with** nothing (it is the first).

**Context to load** — `docs/blocks-plan.md` under *What is actually there today* and *Decisions* 1–2;
`docker-compose.yml` (the three bind mounts and the `wpdev:extra-mounts` marker); the kit's
`bin/wpdev` `cmd_add` (read-only) for what `wpdev add plugin` creates.

**Do**

1. Write `tools/install-blocks-plugin.sh`: pins `VERSION=4.8.6`, downloads
   `https://github.com/wpengine/wp-graphql-content-blocks/releases/download/v${VERSION}/wp-graphql-content-blocks.zip`
   to a temporary directory, checks it is a zip, and refuses to continue if the project plugin
   directory is missing. It never touches the kit.
2. `wpdev add plugin wp-graphql-content-blocks` — creates `wp-content/plugins/wp-graphql-content-blocks`
   and the mount, and activates the stub.
3. Replace the stub (`wp-graphql-content-blocks.php`, the local plugin header) with the release's
   contents, keeping the release's own main file, then `wpdev wp plugin activate
   wp-graphql-content-blocks` and confirm the version WordPress reports.
4. Prove durability, not just success: `wpdev restart .`, then confirm the plugin is still active and
   the directory is still the project's (mounted) one, not something inside the volume.
5. **Probe the schema.** Query one seeded page for its blocks and paste the exact query and a trimmed
   response into this file. Record: the field name, whether attributes arrive as JSON or as
   individual fields, how a paragraph's HTML is carried, how inner blocks nest, and how an unknown
   block appears (`core/missing`).
6. Add `wp-content/plugins/wp-graphql-content-blocks/` to `.gitignore` with a comment saying the
   vendor code is installed by the script and pinned there.

**In scope** — `tools/install-blocks-plugin.sh` (new), `.gitignore`, the plugin directory under
`wp-content/plugins/`, and the WordPress database through `wpdev wp`.

**Out of scope** — the frontend, `docs/blocks-plan.md`, `~/Desktop/dev/wp-kit/`, any other plugin, any
WordPress setting, and any block content: this task installs and observes.

**Acceptance criteria**

- `wpdev wp plugin list --status=active` shows `wp-graphql-content-blocks` **4.8.6**.
- `wpdev restart .` then re-listing shows it still active, and
  `wpdev wp plugin get wp-graphql-content-blocks --field=plugin_uri` names the vendor's repository.
- A GraphQL query for one page's blocks returns a non-empty list, pasted into this file with the
  field name and the shape of one paragraph block.
- `git status --short` shows no change under `wp-kit/` and no vendor files staged for commit.

**Verify** — the two `wpdev wp` commands above, the restart, and the `curl` GraphQL probe whose output
is pasted here.

**Size** — S

> verified 2026-09-12. `./tools/install-blocks-plugin.sh` (new, pinned to v4.8.6) after
> `wpdev add plugin wp-graphql-content-blocks`.
>
> **Installed and durable.** The script downloaded the release and unpacked **63 files** into
> `wp-content/plugins/wp-graphql-content-blocks/`, whose header reads `Plugin Name: WPGraphQL Content
> Blocks … Version: 4.8.6 … Requires Plugins: wp-graphql`. `wpdev add plugin` wrote the mount
> (`./wp-content/plugins/wp-graphql-content-blocks:/var/www/html/wp-content/plugins/…`), so this is
> project code on the host, not a directory inside the `wp_data` volume. `wpdev wp plugin list` shows
> `wp-graphql-content-blocks 4.8.6 active`, and it still does **after `wpdev restart .`**.
> `.gitignore` now excludes the directory — `git status --porcelain wp-content/plugins` listed it as
> untracked before the entry and nothing after.
>
> **The schema, probed rather than assumed.** Two corrections to what the brief expected:
>
> 1. **The field is `editorBlocks`, not `contentBlocks`**, and it is declared on
>    `NodeWithEditorBlocks` / `NodeWithPageEditorBlocks`, both of which `Page` implements. It takes
>    `flat: Boolean` — nested by default, flat on request. Nesting is what the renderer wants.
> 2. **`attributes` is not on the `EditorBlock` interface.** The interface carries `name`, `type`,
>    `isDynamic`, `clientId`, `cssClassNames`, `renderedHtml`, `parentClientId` and `innerBlocks`;
>    each block's own attributes live on a per-block type (`CoreParagraphAttributes`,
>    `CoreHeadingAttributes`, …). So the query needs one inline fragment per mapped block, which is
>    also how an unmapped block degrades gracefully: no fragment matches, `attributes` is simply
>    absent, and `innerBlocks` still arrives.
>
> Shapes confirmed against the running install (all strings unless noted):
> `CoreParagraphAttributes.content` · `CoreHeadingAttributes.content` + `level: Float!` ·
> `CoreListAttributes.ordered: Boolean!`, `reversed`, `start`, `type`, `values` ·
> `CoreListItemAttributes.content` · `CoreQuoteAttributes.value` + `citation` ·
> `CoreSpacerAttributes.height` · `CoreImageAttributes` with `mediaDetails: MediaDetails` on the
> block itself · `CoreButtonAttributes.text`, `url`, `linkTarget`, `rel`, `tagName`, `type` ·
> `CoreColumnsAttributes.isStackedOnMobile: Boolean!`, `verticalAlignment` ·
> `CoreColumnAttributes.width`, `verticalAlignment`.
>
> The probe, run against the WordPress's own Sample Page, returned `editorBlocks` with
> `name: "core/paragraph"`, `type: "CoreParagraph"`, `isDynamic: false`,
> `attributes: { content: "This is an example page. It's different from a blog post because…" }`,
> `innerBlocks: []`, followed by a `core/quote` block whose `innerBlocks` hold the quoted paragraph —
> which is exactly the nesting the renderer walks:
>
> ```graphql
> { page(id: "/sample-page/", idType: URI) { title
>     editorBlocks {
>       name type isDynamic
>       ... on CoreParagraph { attributes { content } }
>       ... on CoreHeading { attributes { content level } }
>       ... on CoreList { attributes { ordered values } }
>       innerBlocks {
>         name
>         ... on CoreParagraph { attributes { content } }
>         ... on CoreListItem { attributes { content } }
>       } } } }
> ```

---

### B2 — The block renderer and its mapping table

**Goal** — `lib/wp/blocks.ts` and `components/blocks/block-content.tsx` render every block in the
plan's table from a fixture, and render an unknown block's children instead of failing.

**Depends on** B1 (for the block shape). **Parallel with** B3.

**Context to load** — `docs/blocks-plan.md` under *The block map* and *The hard parts*;
`B1`'s schema probe in this file; `frontend/src/components/ui/prose.tsx` (to see which elements it
styles, so the renderer emits exactly those); `frontend/src/components/ui/button.tsx`
(`buttonStyles`); `frontend/src/components/layout/info-page.tsx` (the `h1` the renderer must not
duplicate).

**Do**

1. `lib/wp/blocks.ts`: the block type as B1 recorded it, a `normalise()` that turns the transport's
   shape into one flat, exhaustive shape, and a `renderBlock()` table keyed by block name. Pure — no
   React import, no fetching.
2. `components/blocks/block-content.tsx`: the recursive component. Paragraphs and headings keep their
   inline HTML; everything else composes elements.
3. Heading levels: `h1` becomes `h2`, because `InfoPage` owns the page's only `h1`. Say so in a
   comment beside the rule.
4. Unknown, `core/missing`, and an empty block name all render `innerBlocks`; `core/html` renders
   nothing at all. Each is one line, and each is commented with the reason.
5. Columns and buttons are the only two blocks allowed Tailwind classes; everything else is
   unclassed so `Prose` styles it. Buttons use the existing `buttonStyles`.
6. Prove it from a fixture before any page depends on it: render a fixture holding one of every mapped
   block plus an unknown block, a `core/missing` block and a `core/html` block, and read the result
   back through the DOM.

**In scope** — `frontend/src/lib/wp/blocks.ts`, `frontend/src/components/blocks/` (new), and a
temporary fixture used for the check.

**Out of scope** — the five page files (that is B4), any existing component, `InfoPage`, `Prose`,
`buttonStyles`, the GraphQL query document, and the WordPress side.

**Acceptance criteria**

- Every row of the plan's table renders the element named there, proved by tag name and text from the
  DOM.
- An `h1` block renders an `h2`; a page rendered through `InfoPage` has exactly one `h1`.
- The unknown block contributes its children to the DOM, `core/missing` contributes its content
  without error, and `core/html` contributes nothing.
- `npx tsc --noEmit` and `npm run lint` are clean, with no new dependency in `package.json`.

**Verify** — the fixture read back through the DOM, with the tag names and text pasted here; `tsc`,
`lint`, and `git diff --stat frontend/package.json` showing no change.

**Size** — M

---

### B3 — The five pages are seeded into WordPress as blocks

**Goal** — `/about`, `/contact`, `/privacy`, `/shipping-returns` and `/terms` exist in WordPress as
published pages whose blocks hold **exactly** today's copy, written by an idempotent script.

**Depends on** B1. **Parallel with** B2.

**Context to load** — the five page files (they are the source of the words); the theme's
`tools/seed-products.php` for the house pattern (bail if already done, `wp_insert_post`, meta, output
that says what happened); `docs/blocks-plan.md` Decision 7.

**Do**

1. `wp-content/themes/vapestack-theme/tools/seed-pages.php`: for each of the five pages, find by
   slug, create if missing, and write `post_content` as block markup built from the existing copy —
   paragraphs, `h2` headings, lists, the `strong` runs inside them.
2. Idempotent by slug: a page that already exists is updated, not duplicated, and the run says what
   it did for each.
3. Run it through `wpdev wp eval-file`, then read all five back over GraphQL.
4. **Prove the move mechanically**: for each page, count paragraphs, headings and list items in the
   JSX today and in the blocks now, and compare the plain text with the tags stripped. Paste the
   comparison table into this file. Any difference is a bug in the seed, not in the copy.

**In scope** — the new theme tool script, the WordPress database through `wpdev wp`, and this task's
evidence.

**Out of scope** — the frontend entirely, `wp-content/themes/vapestack-theme/{functions.php,style.css}`,
the product import, Elementor, and any page that is not one of the five.

**Acceptance criteria**

- `wpdev wp post list --post_type=page` shows the five slugs published.
- Running the script twice leaves five pages, not ten, and the second run reports updates.
- The stripped text of each WordPress page equals the stripped text of the corresponding JSX body,
  character for character after whitespace normalisation.
- Each page's blocks include at least one heading and one list item, so the editor opens on real
  structure rather than a wall of paragraphs.

**Verify** — the run's output, the `wp post list` output, the GraphQL read of one page, and the
before/after comparison table pasted here.

**Size** — M

---

### B4 — The five pages read their blocks, and the JSX copy is deleted

**Goal** — each page keeps its `metadata` and its `InfoPage` shell, takes its body from WordPress, and
no longer holds a copy of the words.

**Depends on** B2, B3. **Parallel with** nothing.

**Context to load** — `docs/blocks-plan.md` Steps Phase 3 and *Constraints*; `B2`'s renderer and
`B3`'s slugs; `frontend/src/lib/wp/graphql.ts` (how a query is written and cached) and
`frontend/src/lib/wp/queries.ts`; `app/product/[slug]/page.tsx` for the `readProduct` pattern that
turns an upstream failure into a designed state rather than an exception.

**Do**

1. Add the page-blocks query to `lib/wp/queries.ts` and a `getPageBlocks(slug)` beside the catalogue
   readers, cached the same way, returning `undefined` when WordPress cannot be reached and `null`
   when the page does not exist — the same two-outcome split the product page uses.
2. Give each of the five pages a small server read and render
   `<InfoPage …><BlockContent blocks={blocks} /></InfoPage>`.
3. `contact` keeps `ContactForm` exactly as it is: its prose comes from blocks, its form stays a
   component.
4. Delete the JSX copy. Do not keep it as a fallback — two copies of the same words drift, and the
   plan says so.
5. A page that WordPress cannot answer renders `OfflineNotice`, the same designed state every other
   route falls back to.

**In scope** — the five `app/*/page.tsx` files, `frontend/src/lib/wp/queries.ts`, and a new
`getPageBlocks` in the WordPress reader layer.

**Out of scope** — `InfoPage`, `Prose`, `ContactForm`, the layout, the header and footer, the
catalogue queries, Stripe, the cart and the checkout.

**Acceptance criteria**

- All five pages render the same visible text as before, proved by comparing `innerText` with the
  pre-change text for each route.
- With WordPress stopped, each of the five renders `OfflineNotice` — a designed page, not a stack
  trace or an empty body.
- `git diff --stat` shows no change to any file listed as out of scope.
- `tsc`, `lint` and `build` are clean.

**Verify** — the five routes fetched and compared before/after; WordPress stopped and the five fetched
again; `wpdev up` after; `git diff --stat`.

**Size** — M

---

### B5 — The round trip is proved, and the sweep

**Goal** — a paragraph edited in the Block Editor appears on the Next.js page, and the whole change is
swept at three widths, online and offline.

**Depends on** B4. **Parallel with** nothing.

**Context to load** — `docs/blocks-plan.md` under *The hard parts* and *Verification*; the shared
commands in this file; `frontend/UI-STANDARDS.md` for the widths and the screenshot rules.

**Do**

1. Edit a paragraph of `/about` through the WordPress REST API with the application credential from
   `.env`, exactly as the block editor would write it. Reload the page on 3002 and show the new
   sentence in the DOM.
2. Revert the edit and show the original sentence back. Nothing may be left changed.
3. Insert a block the renderer does not map, and a `core/html` block, and confirm the page still
   renders its other content.
4. Sweep the five routes at **1440x900, 768x1024 and 390x844** with `file` confirming each PNG, and
   check `scrollWidth === innerWidth` on every one.
5. Stop WordPress, sweep the five again, confirm the designed offline state, bring WordPress back and
   run `wpdev smoke` (10 checks).

**In scope** — verification only, plus the WordPress content it edits and reverts.

**Out of scope** — every source file. If this task finds a bug it reports it; the fix belongs to the
task that owns the file.

**Acceptance criteria**

- The edited sentence is in the DOM of `/about` on the Next.js side after a reload, and the revert is
  equally visible.
- An unmapped block and a `core/html` block change nothing about the rest of the page.
- Five routes x three widths are screenshots with confirmed dimensions and zero horizontal overflow.
- With WordPress down, all five routes show the offline state; after `wpdev up`, `wpdev smoke` is
  10/10.

**Verify** — the DOM readings, the screenshot files with `file` output, and `wpdev smoke`.

**Size** — M
