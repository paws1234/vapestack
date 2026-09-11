import Link from "next/link";
import { JsonLd } from "@/components/product/json-ld";
import { absoluteUrl } from "@/lib/site";

/** One step of the trail. */
export type Crumb = {
  /** Text shown in the trail. */
  name: string;
  /** Route the step points at. The last crumb is never a link. */
  href: string;
};

/**
 * The trail to the current page, as a nav and as `BreadcrumbList` structured data.
 *
 * Both come out of one array on purpose: a trail that says one thing to a visitor and another to a
 * crawler is worse than either alone, and the only way to keep them in step is to derive them from
 * the same list.
 *
 * The last crumb is plain text rather than a link to the page you are already on, and carries
 * `aria-current="page"` so it is announced as the current location rather than as another stop.
 *
 * @param props.items Trail from the home page down to this one, in order.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {items.map((item, index) => {
            const last = index === items.length - 1;

            return (
              <li key={item.href} className="flex items-center gap-x-2">
                {last ? (
                  <span aria-current="page" className="text-ink-200">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.href} className="text-ink-400 transition hover:text-neon-400">
                    {item.name}
                  </Link>
                )}

                {/* Separators are drawn, not read: a screen reader already gets the list structure. */}
                {last ? null : (
                  <span aria-hidden className="text-ink-700">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.href),
          })),
        }}
      />
    </>
  );
}
