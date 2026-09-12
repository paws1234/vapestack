import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AgeGate } from "@/components/age-gate";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ShopOfflineStrip } from "@/components/layout/shop-offline-strip";
import { SearchDialog } from "@/components/search/search-dialog";
import { SkipLink } from "@/components/ui/skip-link";
import { AGE_GATE_SCRIPT } from "@/lib/age-gate";
import { buildSearchIndex } from "@/lib/search-index";
import { siteUrl } from "@/lib/site";
import { getCatalogue } from "@/lib/wp/catalog";
import "./globals.css";

/** One description, used by the metadata, OpenGraph and Twitter tags alike. */
const DESCRIPTION =
  "A portfolio vape storefront: Next.js and Tailwind in front, a real WooCommerce and WPGraphQL shop behind it. 21+ only, nothing ships.";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 * Every route renders per request, and it is declared here rather than on each page because this
 * is where the reason lives: the header below reads the catalogue for its navigation, so every
 * route under this layout touches WordPress. The deployed build must not depend on it - WordPress
 * is reached through a tunnel that is only open while the development machine is running - and a
 * route that is rendered per request cannot fetch anything at build time. The catalogue's own
 * five-minute data cache still keeps this from being a read on every view.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /*
    `metadataBase` is what turns every relative URL in metadata - the OpenGraph image, the
    canonical, the icon - into the absolute one a crawler or a chat client needs. Without it Next
    warns and emits `http://localhost:3000` in production.
  */
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Vapestack",
    template: "%s | Vapestack",
  },
  description: DESCRIPTION,
  applicationName: "Vapestack",
  openGraph: {
    type: "website",
    siteName: "Vapestack",
    title: "Vapestack",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vapestack",
    description: DESCRIPTION,
  },
  /*
    The tab icon is the brand mark, cut square out of `resources/image.jpg` and written to
    `app/favicon.ico` by `resources/make-icons.mjs` - 16, 32 and 48 pixel frames in one file, which
    is why no size is named here. Mentioning it explicitly rather than relying on the file
    convention keeps it in the metadata where it can be seen.
  */
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
  },
};

/**
 * The browser chrome colour, in the page background token.
 *
 * `themeColor` lives in the `viewport` export rather than in `metadata` - Next moved it, and a
 * `themeColor` left in `metadata` is ignored with a warning.
 */
export const viewport: Viewport = {
  themeColor: "#07080c",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const catalogue = await getCatalogue();
  const categories = catalogue?.categories ?? [];

  /*
    The search index comes from the read above - no second fetch, no route handler and nothing at
    build time. It is deliberately slim: an entry is a name, where it goes and the words that find
    it. The products' HTML descriptions stay on the server, where they are not paid for on every
    page.
  */
  const searchIndex = buildSearchIndex(catalogue?.products ?? [], categories);

  return (
    <html
      lang="en"
      /*
        The inline script below sets `data-age-gate` on this element before React hydrates.
        React only owns the props it renders, so it is told not to compare this element's
        attributes - the same reason theming scripts need it.
      */
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          First in the document on purpose: it is the first thing Tab reaches, and it is what
          lets a keyboard visitor skip the wordmark, the five nav links and the cart on every page.
        */}
        <SkipLink />

        {/*
          Runs before the first paint, long before React: it hides the age gate for a visitor
          who has already confirmed, so no returning visitor sees the shop flash behind it.
          `AGE_GATE_SCRIPT` explains itself.
        */}
        <script dangerouslySetInnerHTML={{ __html: AGE_GATE_SCRIPT }} />

        <Header />
        {/*
          Above `<main>` and inside the layout, so every route gets it: the strip says the shop
          behind the site is offline, which is the one thing a visitor cannot work out from a page
          that still renders. It renders nothing when WordPress is answering.
        */}
        <ShopOfflineStrip />
        {/*
          `id` and `tabIndex` together are what the skip link needs: the id is the target, and the
          tab index is what moves focus there. Without it the page would scroll and leave focus on
          the link itself, which reads as a skip link that does nothing.
        */}
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <Footer />

        {/*
          Both overlays live outside `<header>`: that element is `backdrop-blur`, and a
          `backdrop-filter` would make it the containing block for anything `fixed` inside it.
          Both stay mounted and carry `inert` while closed, so a hidden panel cannot be tabbed
          into.
        */}
        <CartDrawer />
        <MobileNav categories={categories} />
        <SearchDialog index={searchIndex} />
        <AgeGate />
      </body>
    </html>
  );
}
