import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AgeGate } from "@/components/age-gate";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ShopOfflineStrip } from "@/components/layout/shop-offline-strip";
import { SkipLink } from "@/components/ui/skip-link";
import { AGE_GATE_SCRIPT } from "@/lib/age-gate";
import { getCatalogue } from "@/lib/wp/catalog";
import "./globals.css";

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
  title: {
    default: "Vapestack",
    template: "%s | Vapestack",
  },
  description:
    "A headless vape storefront: Next.js and Tailwind on the front, WooCommerce and WPGraphQL behind it.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /*
    The mobile nav needs the same ranges the header shows. Reading them here rather than inside
    the panel keeps `MobileNav` a plain client component, and costs nothing: `getCatalogue()` is
    wrapped in React `cache()`, so the header's read and this one are the same read.
  */
  const categories = (await getCatalogue())?.categories ?? [];

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
        */}
        <CartDrawer />
        <MobileNav categories={categories} />
        <AgeGate />
      </body>
    </html>
  );
}
