"use client";

import { QRCodeSVG } from "qrcode.react";

import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/payment-simulation";
import { absoluteUrl } from "@/lib/site";

/**
 * How the visitor would like to pretend to pay.
 *
 * A native radio group rather than a row of buttons: arrow keys move between the two, the group is
 * announced as one control, and a screen reader hears "QR payment, selected" without any ARIA of
 * our own. The radios are `sr-only` inside their own `<label>`, with the visible pill in a sibling
 * span so `peer-focus-visible:` can draw the focus ring — the same shape the product page's
 * selectors use, for the same reason.
 *
 * Only the chosen method's panel is in the DOM, so the page holds one method's content and no
 * other's. A card was the reason that rule mattered. It is not any more: a card is taken by Stripe
 * now, in its own fields, which this component never sees and cannot render.
 *
 * Every claim here is labelled. Each method says in its own words what it does or does not do. The
 * two simulated ones carry no card-brand logo and no padlock, because neither would be true of
 * them; the card method's fields come from Stripe, which brings its own.
 *
 * The QR is the one method whose artefact is genuine: a real symbol, carrying a real address in
 * this shop (see {@link QrPanel}). It is a demonstration of the *flow*, not of a payment, and both
 * the note beside it and the address itself are on the page rather than implied.
 *
 * @param props.value    The method currently chosen.
 * @param props.onChange Called with the newly chosen method.
 */
export function PaymentMethods({
  value,
  onChange,
}: {
  value: PaymentMethodId;
  onChange: (method: PaymentMethodId) => void;
}) {
  return (
    <div data-payment-method={value} className="space-y-5">
      <fieldset>
        <legend className="text-xs uppercase tracking-[0.25em] text-ink-400">Payment method</legend>

        <p className="mt-2 text-sm text-ink-200">
          One of these takes a real payment: Card runs through Stripe in <strong>test mode</strong>,
          so the flow is real and no real card is charged. The other two are demonstrations of
          checkout flows, not connections to a payment provider.
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
        One panel, holding the chosen method's own content — and only the chosen one's: switching
        method unmounts what the other had, so nothing a visitor typed is left behind in the DOM.
      */}
      <div className="rounded-2xl border border-line bg-ink-950/60 p-4">
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
 * The QR panel.
 *
 * The symbol is a real one. It used to be a drawing — markers plus a deterministic filler — on the
 * grounds that a genuine code would be a lie about what it points at. That reasoning was backwards:
 * a code that points at *nothing* is the lie, and a real symbol carrying a real address in this
 * shop needs no merchant account to be honest. `qrcode.react` produces it, so what a phone camera
 * reads is an address rather than a pattern.
 *
 * The address is printed beside the code, which is what a visitor without a camera (or with a phone
 * that cannot reach a development host) reads instead. Nothing about the payment changes: there is
 * no merchant behind the code, so it cannot charge anything, and the note says so.
 *
 * Encoded during render rather than painted on a canvas: the symbol is part of the markup, so there
 * is no measuring pass on the client and the server's HTML already holds the same code.
 */
function QrPanel() {
  /*
    Absolute, because a scanner has no page to resolve a relative path against. `NEXT_PUBLIC_SITE_URL`
    is inlined at build time, so the server render and the hydration render encode one string.
  */
  const target = absoluteUrl("/checkout");

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/*
        The light plate is the quiet zone a scanner needs: 2 modules of it are inside the symbol and
        the padding here adds the rest, which is why the plate is `ink-50` rather than the panel's
        own dark background.
      */}
      <div className="rounded-xl border border-line bg-ink-50 p-2">
        <QRCodeSVG
          value={target}
          size={QR_PIXELS}
          level="M"
          marginSize={2}
          bgColor={QR_LIGHT}
          fgColor={QR_DARK}
          title={`QR code containing ${target}`}
        />
      </div>

      <div className="min-w-[14rem] flex-1">
        <p className="text-sm font-medium text-ink-50">QR payment — a real code, still a demo</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-400">
          This is a working QR code, not a drawing of one: a phone camera reads it, and what it reads
          is this shop&rsquo;s own checkout address, printed below. Any phone that can reach this
          host opens that page; there is no merchant account behind the code, so it cannot take a
          payment. It shows what a QR method would look like in a real shop, and submitting records
          that this method was simulated.
        </p>
        <p className="mt-2 font-mono text-[0.7rem] leading-relaxed break-all text-ink-200">
          {target}
        </p>
      </div>
    </div>
  );
}

/** How wide the symbol is in pixels. */
const QR_PIXELS = 148;

/*
  The symbol's own two colours, because a Tailwind class cannot reach a `fill` the component sets
  as a presentation attribute. These literals are `--color-ink-50` and `--color-ink-950` from
  `globals.css`.
*/
const QR_LIGHT = "#f5f7fb";
const QR_DARK = "#07080c";
