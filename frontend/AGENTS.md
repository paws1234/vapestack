<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Read `UI-STANDARDS.md` before changing anything visual

`UI-STANDARDS.md` in this directory is the measured record for this storefront: the contrast table
read out of the running site, the type and spacing rhythm, the five states every control has to
define, the accessibility checklist, the reduced-motion rule, the responsive contract, and the
Tailwind v4 traps this project has already paid for.

It is not advice. A visual change is judged against its numbers — re-measure in the browser rather
than trusting a token's hex value, because the two disagree as soon as a semi-transparent surface
is involved — and a change that proves a new rule adds it there.

