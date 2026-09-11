#!/usr/bin/env node
/**
 * Rebuilds the site's tab icon from the brand master in this folder.
 *
 * `image.jpg` is the artwork as it was supplied: 784x1168, the mark floating on a black field. This
 * script measures the mark's own bounds, squares it up, and writes two files:
 *
 *   * `icon.png` — the square master, 512x512, kept here as the reference the site's icons are
 *     exported from and the file to hand to anything else that wants a logo.
 *   * `../frontend/src/app/favicon.ico` — what the browser shows in the tab: 16, 32 and 48 pixel
 *     frames in one file, which is what a tab strip, a bookmark list and a high-DPI screen ask for.
 *
 * Run it from the repository root:
 *
 *     node resources/make-icons.mjs
 *
 * It uses `sharp`, which is the frontend's own image library (Next depends on it for `next/image`),
 * so generating one icon needs no second toolchain.
 *
 * A 256x256 frame was measured and left out: this artwork is full of glow and gradient, so the extra
 * frame took the ICO from 6 KiB to 77 KiB for a size no tab uses.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const SOURCE = path.join(HERE, "image.jpg");
const MASTER = path.join(HERE, "icon.png");
const FAVICON = path.join(ROOT, "frontend", "src", "app", "favicon.ico");

/* Resolved through the frontend's manifest, so the script runs from anywhere and uses its sharp. */
const sharp = createRequire(path.join(ROOT, "frontend", "package.json"))("sharp");

const MASTER_SIZE = 512;
const ICO_SIZES = [16, 32, 48];
/** How much brighter than the black field a pixel must be to count as part of the mark. */
const THRESHOLD = 25;
const BACKGROUND = "#000000";

/**
 * The mark on its own, squared up.
 *
 * The bounding box is measured from the pixels rather than asked of a helper: `trim` reports the
 * offset it cut at, but on this artwork it answered -148,-261 — outside the image it read them from
 * — which is not a number a crop can be built on. Everything brighter than `THRESHOLD` is the mark;
 * that box is centred and squared, so the supplied file's padding is measured and the mark keeps its
 * own proportions instead of being stretched to fit a tab.
 */
async function squaredMark() {
  const { data, info } = await sharp(SOURCE)
    .flatten({ background: BACKGROUND })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * channels;
      /* Rec. 601 luma, the same weighting a greyscale conversion uses. */
      const luma = 0.299 * data[at] + 0.587 * data[at + 1] + 0.114 * data[at + 2];

      if (luma > THRESHOLD) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < 0 || bottom < 0) {
    throw new Error(`${path.basename(SOURCE)} looks empty: nothing in it is brighter than ${BACKGROUND}`);
  }

  const side = Math.max(right - left, bottom - top) + 1;
  const box = {
    left: Math.round((left + right) / 2 - side / 2),
    top: Math.round((top + bottom) / 2 - side / 2),
    width: side,
    height: side,
  };

  console.log(`  mark at x ${left}-${right} y ${top}-${bottom} -> ${side}px square at ${box.left},${box.top}`);

  return sharp(SOURCE)
    .extract(box)
    .resize(MASTER_SIZE, MASTER_SIZE)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * An ICO file holding PNG frames.
 *
 * The container is 40 bytes of headers plus the frames themselves, which is why it is written here
 * rather than pulled in as another dependency: a 6-byte header, a 16-byte directory entry per frame,
 * then the payloads. A browser reads this the same way it reads a hand-drawn `.ico`.
 *
 * @param frames Frames as `{ size, png }`, smallest first.
 */
function ico(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); /* reserved */
  header.writeUInt16LE(1, 2); /* 1 = icon */
  header.writeUInt16LE(frames.length, 4);

  let offset = header.length + 16 * frames.length;

  const directory = frames.map(({ size, png }) => {
    /* A byte cannot hold 256, so the format writes 0 and means 256. */
    const dimension = size >= 256 ? 0 : size;
    const entry = Buffer.alloc(16);

    entry.writeUInt8(dimension, 0); /* width */
    entry.writeUInt8(dimension, 1); /* height */
    entry.writeUInt8(0, 2); /* palette colours: none */
    entry.writeUInt8(0, 3); /* reserved */
    entry.writeUInt16LE(1, 4); /* colour planes */
    entry.writeUInt16LE(32, 6); /* bits per pixel */
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;

    return entry;
  });

  return Buffer.concat([header, ...directory, ...frames.map((frame) => frame.png)]);
}

async function main() {
  const { width, height } = await sharp(SOURCE).metadata();
  console.log(`${path.basename(SOURCE)}: ${width}x${height}`);

  const master = await squaredMark();

  await writeFile(MASTER, master);
  console.log(`  wrote ${path.relative(ROOT, MASTER)} (${MASTER_SIZE}x${MASTER_SIZE})`);

  const frames = await Promise.all(
    ICO_SIZES.map(async (size) => ({
      size,
      /*
        RGBA, not RGB: Next decodes this file during `next build` and refuses an ICO whose frames
        are not RGBA — "Format error decoding Ico: The PNG is not in RGBA format!". The mark sits on
        an opaque field, so the added alpha channel is fully opaque and nothing about it changes.
      */
      png: await sharp(master).resize(size, size, { fit: "fill" }).ensureAlpha().png().toBuffer(),
    })),
  );

  await mkdir(path.dirname(FAVICON), { recursive: true });
  const file = ico(frames);
  await writeFile(FAVICON, file);
  console.log(`  wrote ${path.relative(ROOT, FAVICON)} (${ICO_SIZES.join(", ")}px in one file)`);

  /*
    Read the written file back by hand, because libvips cannot open an ICO and `sharp` therefore
    cannot check this for us. What matters is the thing `next build` complains about: every frame is
    a PNG, and its IHDR says colour type 6 (truecolour with alpha).
  */
  const written = await readFile(FAVICON);
  const types = frames.map(({ png }) => {
    const embedded = written.includes(png);
    const colourType = png.readUInt8(25);

    if (!embedded || 6 !== colourType) {
      throw new Error(`frame is not an RGBA PNG in the written file (colour type ${colourType})`);
    }

    return `${png.length >> 10} KiB`;
  });

  console.log(`  read back: ico with ${frames.length} RGBA PNG frames (${types.join(", ")})`);
}

await main();
