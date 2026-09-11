/** Small print, and the age notice the shop has to carry. */
export function Footer() {
  return (
    <footer className="mt-20 border-t border-ink-800 bg-ink-900/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-ink-400 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-ink-200">Vapestack</p>
          <p>Headless storefront demo — Next.js and Tailwind in front, WooCommerce and WPGraphQL behind.</p>
        </div>

        <div className="space-y-1 md:max-w-md">
          <p className="text-ink-200">21+ only.</p>
          <p>
            Sample catalogue built for portfolio purposes. Nothing is really sold here, no payment
            is taken, and no nicotine products ship.
          </p>
        </div>
      </div>
    </footer>
  );
}
