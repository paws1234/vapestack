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
 * Renders a price, or both ends of a range.
 *
 * A variable product's variations can differ in price, and "from $9.99" leaves the customer to
 * guess the other end. Both ends are shown instead, separated by an en dash: the two numbers carry
 * the same type scale and weight as a single price, so a range is not a small word glued to a big
 * one. The dash is decorative and hidden from assistive technology, which would otherwise read it
 * as "en dash" between the two amounts.
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
      {FORMATTER.format(min)}
      <span aria-hidden className="mx-1 font-normal text-ink-400">
        –
      </span>
      {FORMATTER.format(max)}
    </span>
  );
}
