import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Prose } from "@/components/ui/prose";

/**
 * The shell every information page shares.
 *
 * These pages are static text about the demo itself, so they read the catalogue for nothing and
 * render with WordPress stopped — which is the point of putting them here rather than in WordPress.
 *
 * The body copy is passed unclassed and styled by `Prose`, so the page files read like the content
 * they hold instead of like a stylesheet.
 *
 * @param props.title   Page heading.
 * @param props.intro   One-paragraph summary, above the rule.
 * @param props.updated Date the copy last changed, shown to the visitor.
 * @param props.children The body copy.
 */
export function InfoPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <Container width="narrow" className="py-10">
      <h1 className="text-3xl font-semibold text-ink-50 sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-ink-200">{intro}</p>
      <p className="mt-2 text-sm text-ink-400">Last updated {updated}</p>

      <div className="mt-8 border-t border-ink-800 pt-8">
        <Prose>{children}</Prose>
      </div>

      <div className="mt-12 border-t border-ink-800 pt-6">
        <Link href="/shop" className="text-sm text-neon-400 transition hover:text-neon-300">
          ← Back to the shop
        </Link>
      </div>
    </Container>
  );
}
