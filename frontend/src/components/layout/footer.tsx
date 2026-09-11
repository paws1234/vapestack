import Link from "next/link";
import { AgeGateReset } from "@/components/layout/age-gate-reset";
import { FooterRangeGroup } from "@/components/layout/footer-range-group";
import { Container } from "@/components/ui/container";
import { GROUP_LABEL, splitRanges } from "@/lib/nav";
import { getCatalogue } from "@/lib/wp/catalog";

/** Where the demo is deployed, and where its source lives. */
const LIVE_URL = "https://vapestack-paws1234s-projects.vercel.app";
const REPO_URL = "https://github.com/paws1234/vapestack";

/** One footer link's classes, so the shop column and the other columns cannot drift apart. */
const LINK = "text-ink-200 transition hover:text-neon-400";

/** One titled column of links. */
function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-[0.25em] text-ink-400">{title}</h2>

      <ul className="mt-4 space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={LINK}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The end of every page.
 *
 * A shop's footer, rather than a summary of the technology: the ranges are reachable from here,
 * the legal pages exist, the age notice is impossible to miss, and the copyright line is where a
 * visitor looks for it. The old footer explained the stack under every page — that belongs on
 * `/about`, where someone has asked the question.
 *
 * The category links are read from the catalogue and degrade to "Shop all" alone when WordPress
 * cannot be reached. The footer is not worth failing a page over, exactly as the header is not,
 * and that fallback is why the shop column is built from the catalogue rather than written out by
 * hand. The hardware ranges are grouped behind one `Vape` trigger — the same rule and the same
 * behaviour as the header's menu (`lib/nav.ts`, `lib/use-disclosure.ts`), so a nine-range catalogue
 * does not turn the column into a wall of ten links.
 */
export async function Footer() {
  const categories = (await getCatalogue())?.categories ?? [];
  const { inline, grouped } = splitRanges(categories);

  return (
    <footer className="mt-20 border-t border-ink-800 bg-ink-900/40">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-semibold tracking-[0.25em] text-ink-50">VAPESTACK</p>
            <p className="mt-4 text-sm text-ink-200">
              Devices, liquids and pods, read from a live WooCommerce catalogue. A portfolio demo:
              nothing here is really for sale.
            </p>
            <p className="mt-4 flex flex-wrap gap-4 text-sm">
              <a href={LIVE_URL} className="text-ink-400 transition hover:text-neon-400" rel="noreferrer">
                Live demo
              </a>
              <a href={REPO_URL} className="text-ink-400 transition hover:text-neon-400" rel="noreferrer">
                Source
              </a>
            </p>
          </div>

          {/*
            Built here rather than through `FooterColumn`: this column is the only one that mixes
            plain links with a disclosure, and the group has to sit inside the same list.
          */}
          <div>
            <h2 className="text-xs uppercase tracking-[0.25em] text-ink-400">Shop</h2>

            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/shop" className={LINK}>
                  Shop all
                </Link>
              </li>

              {inline.map((category) => (
                <li key={category.slug}>
                  <Link href={`/shop/${category.slug}`} className={LINK}>
                    {category.name}
                  </Link>
                </li>
              ))}

              {grouped.length > 0 && (
                <li>
                  <FooterRangeGroup label={GROUP_LABEL} items={grouped} />
                </li>
              )}
            </ul>
          </div>

          <FooterColumn
            title="About"
            links={[
              { href: "/about", label: "About Vapestack" },
              { href: "/contact", label: "Contact" },
            ]}
          />

          <FooterColumn
            title="Help & legal"
            links={[
              { href: "/shipping-returns", label: "Shipping & Returns" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms of use" },
            ]}
          />
        </div>

        <div className="mt-12 rounded-2xl border border-ink-800 bg-ink-950/60 p-6">
          <p className="text-sm font-medium text-ink-50">21+ only.</p>
          <p className="mt-2 text-sm text-ink-200">
            Vapestack carries nicotine products and is for adults aged 21 and over. This is a
            portfolio demo: the products are invented, no payment is ever taken, no order is
            fulfilled, no email is sent and no nicotine product ships.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-ink-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-400">
            © {new Date().getFullYear()} Vapestack. A headless storefront demo — Next.js in front,
            WooCommerce and WPGraphQL behind.
          </p>

          <AgeGateReset />
        </div>
      </Container>
    </footer>
  );
}
