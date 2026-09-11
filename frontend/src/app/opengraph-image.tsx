import { ImageResponse } from "next/og";

/**
 * The share card, drawn by the app itself.
 *
 * Rendered at request time from the same tokens the site is built on, so it cannot drift from the
 * palette the way a checked-in PNG does, and it needs no catalogue — which matters, because a
 * share image that had to read WordPress could not be produced at build time and would be missing
 * exactly when the tunnel is closed.
 *
 * Deliberately site-wide and generic. Per-product cards would need the catalogue at build time,
 * which this project has decided the build must not do.
 */

export const alt = "Vapestack — a headless storefront demo";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#07080c",
          color: "#f5f7fb",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 56, height: 6, backgroundColor: "#b6ff3d" }} />
          <span
            style={{
              fontSize: 26,
              letterSpacing: 10,
              textTransform: "uppercase",
              color: "#b6ff3d",
            }}
          >
            Vapestack
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>
                      Devices, liquids and pods.
          </div>
          <div style={{ fontSize: 32, color: "#c9cfdb" }}>
            A headless storefront demo — Next.js in front, WooCommerce behind.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: "#35e6ff" }} />
          <span style={{ fontSize: 24, color: "#7c8598" }}>
            Portfolio demo. 21+ only. Nothing ships.
          </span>
        </div>
      </div>
    ),
    size,
  );
}
