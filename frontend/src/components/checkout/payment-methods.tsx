"use client";

import { CardForm } from "@/components/checkout/card-form";
import { Badge } from "@/components/ui/badge";
import {
  PAYMENT_METHODS,
  TEST_CARDS,
  TEST_OTP,
  paymentMethod,
  type CardErrors,
  type PaymentMethodId,
} from "@/lib/payment-simulation";

/**
 * How the visitor would like to pretend to pay.
 *
 * A native radio group rather than a row of buttons: arrow keys move between the three, the group
 * is announced as one control, and a screen reader hears "Card, selected" without any ARIA of our
 * own. The radios are `sr-only` inside their own `<label>`, with the visible pill in a sibling span
 * so `peer-focus-visible:` can draw the focus ring — the same shape the product page's selectors
 * use, for the same reason.
 *
 * Only the chosen method's fields are in the DOM. That is not just tidiness: the card fields are
 * the only place a card number could exist, so unmounting them when another method is chosen means
 * there is nowhere for one to be left behind.
 *
 * Every claim here is labelled. The block carries a `Simulation` pill, the test numbers are printed
 * with what they do, and the 3-D Secure code is on the page rather than in a developer's head.
 * There is no card-brand logo and no padlock, because neither would be true.
 *
 * @param props.value      The method currently chosen.
 * @param props.onChange   Called with the newly chosen method.
 * @param props.cardErrors What was wrong with the card at the last submit attempt.
 */
export function PaymentMethods({
  value,
  onChange,
  cardErrors,
}: {
  value: PaymentMethodId;
  onChange: (method: PaymentMethodId) => void;
  cardErrors: CardErrors;
}) {
  return (
    <div data-payment-method={value} className="space-y-5">
      <fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <legend className="text-xs uppercase tracking-[0.25em] text-ink-400">
            Payment method
          </legend>
          <Badge tone="muted">Simulation</Badge>
        </div>

        <p className="mt-2 text-sm text-ink-200">
          Nothing is charged whichever one you pick. These are demonstrations of three checkout
          flows, not connections to a payment provider.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PAYMENT_METHODS.map((method) => {
            const selected = method.id === value;

            return (
              <label key={method.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="payment"
                  value={method.id}
                  checked={selected}
                  onChange={() => onChange(method.id)}
                  className="peer sr-only"
                />

                <span
                  className={[
                    "block h-full rounded-2xl border px-4 py-3 transition",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-neon-400",
                    selected
                      ? "border-neon-400 bg-ink-800"
                      : "border-line bg-ink-950 hover:border-neon-400",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    {/*
                      A drawn tick, not a colour: which method is chosen has to survive a
                      visitor who cannot tell the two greens apart.
                    */}
                    <span aria-hidden="true" className="w-4 text-neon-400">
                      {selected ? "✓" : ""}
                    </span>
                    <span className="font-medium text-ink-50">{method.label}</span>
                  </span>

                  <span className="mt-1 block text-xs leading-relaxed text-ink-400">
                    {method.summary}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/*
        One panel, holding the chosen method's own content. Because it is keyed on the method, the
        card fields are unmounted the moment another method is picked - there is no hidden copy of
        a typed number left in the DOM.
      */}
      <div className="rounded-2xl border border-line bg-ink-950/60 p-4">
        {("card" === value) && (
          <>
            <p className="text-sm font-medium text-ink-50">
              {paymentMethod(value).label} — a sandbox, and nothing else
            </p>

            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              Use one of these numbers. They are published test numbers, the challenge accepts the
              code below, and no digit of either one is sent anywhere: the payment travels to the
              shop as the word “{paymentMethod(value).label.toLowerCase()}”, and nothing more.
            </p>

            <dl className="mt-3 space-y-2 text-xs" data-test-cards>
              {TEST_CARDS.map((card) => (
                <div key={card.number} className="flex flex-wrap gap-x-2">
                  <dt className="font-mono tabular-nums text-ink-200">{card.number}</dt>
                  <dd className="text-ink-400">{card.result}</dd>
                </div>
              ))}
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-mono tabular-nums text-ink-200">{TEST_OTP}</dt>
                <dd className="text-ink-400">The code the simulated challenge accepts.</dd>
              </div>
            </dl>

            <CardForm errors={cardErrors} />
          </>
        )}

        {("qr" === value) && <QrPanel />}

        {("cod" === value) && (
          <div>
            <p className="text-sm font-medium text-ink-50">Cash on delivery — simulated</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              Nothing is dispatched, so there is nothing for a courier to collect and nothing to
              pay on arrival. There is nothing to fill in here either: submitting records that this
              method was simulated, and the checkout still charges nothing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The QR demonstration.
 *
 * A drawn code rather than a real one, because there is no merchant to pay: a genuine QR would be
 * a lie about what it points at, and it would need a dependency to produce. The mark is decorative
 * (`aria-hidden`) and every word that describes it is in the text beside it, so nothing is lost to
 * a visitor who cannot see it.
 */
function QrPanel() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <QrMark />

      <div className="min-w-[14rem] flex-1">
        <p className="text-sm font-medium text-ink-50">QR payment — a demonstration code</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-400">
          This is a drawing of a QR code, not a working one. There is no merchant account behind it
          and nothing to scan, so it cannot take a payment — it shows what a QR method would look
          like in a real shop. Submitting records that this method was simulated.
        </p>
      </div>
    </div>
  );
}

/** Size of the drawn code, in cells and in pixels. */
const QR_CELLS = 21;
const QR_PIXELS = 132;

/** The three position markers of a QR code, as top-left corners in a 21x21 grid. */
const FINDERS: readonly [number, number][] = [
  [0, 0],
  [QR_CELLS - 7, 0],
  [0, QR_CELLS - 7],
];

/**
 * The pattern of one cell.
 *
 * Deterministic on purpose: a random pattern would differ between the server render and the
 * hydration render and show up as a mismatch. `null` means "not inside a marker", which falls
 * through to the filler below.
 *
 * @param x Column.
 * @param y Row.
 */
function finderCell(x: number, y: number): boolean | null {
  for (const [fx, fy] of FINDERS) {
    const dx = x - fx;
    const dy = y - fy;

    if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));

      return 3 === ring || ring <= 1;
    }
  }

  return null;
}

/**
 * Whether one cell of the drawn code is dark.
 *
 * @param x Column.
 * @param y Row.
 */
function isDark(x: number, y: number): boolean {
  const marker = finderCell(x, y);

  return marker ?? 0 === (x * 5 + y * 11 + ((x * y) % 7)) % 3;
}

/** A drawing of a QR code. Decorative; the text beside it carries the meaning. */
function QrMark() {
  const cells = [];

  for (let y = 0; y < QR_CELLS; y += 1) {
    for (let x = 0; x < QR_CELLS; x += 1) {
      if (isDark(x, y)) {
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${QR_CELLS} ${QR_CELLS}`}
      width={QR_PIXELS}
      height={QR_PIXELS}
      aria-hidden="true"
      shapeRendering="crispEdges"
      className="rounded-xl border border-line bg-ink-50 p-2"
    >
      <g fill="#07080c">{cells}</g>
    </svg>
  );
}
