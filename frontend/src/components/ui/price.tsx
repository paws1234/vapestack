/**
 * Prices, formatted consistently.
 *
 * The store is seeded with USD, so the currency is fixed here rather than read back from
 * WooCommerce. Totals shown in the cart are display only: the order that is actually created
 * is priced by WooCommerce from product ids.
 */

const FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * Renders a price, or the cheapest end of a range.
 *
 * @param props.min Cheapest price in the product's variations.
 * @param props.max Most expensive, equal to min when there is only one price.
 */
export function Price({
  min,
  max,
  className = "",
}: {
  min: number;
  max: number;
  className?: string;
}) {
  if (min === max) {
    return <span className={className}>{FORMATTER.format(min)}</span>;
  }

  return (
    <span className={className}>
      <span className="text-xs font-normal text-ink-400">from </span>
      {FORMATTER.format(min)}
    </span>
  );
}
