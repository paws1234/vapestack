import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AgeGate } from "@/components/age-gate";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { AGE_GATE_SCRIPT } from "@/lib/age-gate";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
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
          Runs before the first paint, long before React: it hides the age gate for a visitor
          who has already confirmed, so no returning visitor sees the shop flash behind it.
          `AGE_GATE_SCRIPT` explains itself.
        */}
        <script dangerouslySetInnerHTML={{ __html: AGE_GATE_SCRIPT }} />

        <Header />
        <main className="flex-1">{children}</main>
        <Footer />

        {/*
          Both overlays live outside `<header>`: that element is `backdrop-blur`, and a
          `backdrop-filter` would make it the containing block for anything `fixed` inside it.
        */}
        <CartDrawer />
        <AgeGate />
      </body>
    </html>
  );
}
