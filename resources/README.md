# Brand resources

Source artwork for the storefront's own identity. Nothing here is served by the site directly —
what a browser sees lives in `frontend/src/app/`, and this folder is where it comes from.

| File | What it is |
| --- | --- |
| `image.jpg` | The artwork as it was supplied: 784x1168, the mark floating on a black field. |
| `icon.png` | The square master, 512x512, generated — the mark's bounding box, cropped square and scaled. This is the file to hand to anything that wants a logo. |
| `make-icons.mjs` | The generator. Rebuilds `icon.png` and the site's tab icon from `image.jpg`. |

## Regenerating

```sh
node resources/make-icons.mjs
```

No extra toolchain: the script uses `sharp`, the frontend's own image library — Next depends on it
for `next/image`, and the script resolves it through `frontend/package.json` so it runs from
anywhere. It writes two files and prints the numbers it measured:

- `resources/icon.png` — the 512x512 square master.
- `frontend/src/app/favicon.ico` — **the tab icon**: 16, 32 and 48 pixel frames in one ICO, so a
  browser picks the size it needs and a high-DPI tab strip gets a crisp one.

`favicon.ico` is written straight into the App Router's `app/` folder, which is where Next looks for
a file of that name; `app/layout.tsx` also names it in `metadata.icons` so the link is visible in the
source rather than implied.

The crop is not a guess. The supplied image is portrait and a tab icon must be square, so the script
measures the mark's own bounding box — everything brighter than the black field — centres that box
and cuts a square around it. Measured on the file committed here: mark at x 157-624, y 276-758
(468x483), cropped to a 483px square at `(149, 276)`. The box is measured from the pixels rather
than asked of `sharp.trim()`, which reported an offset of `-148,-261` on this artwork — outside the
image it had just read, and therefore not something a crop can be built on.

Two things the format insists on, both found the hard way:

- **The ICO's frames must be RGBA.** Next decodes the icon during `next build` and refuses an RGB
  one: `Format error decoding Ico: The PNG is not in RGBA format!`
- **libvips cannot open an ICO at all**, so `sharp` cannot verify the file it just wrote. The script
  checks the bytes instead: each frame is present, and its PNG header says colour type 6.

A 256x256 ICO frame was tried and left out: this artwork is heavy with glow and gradient, so the
extra frame took the file from 6 KiB to 77 KiB for a size that no tab uses. Add it back in
`ICO_SIZES` if something like a Windows tile ever needs it.
