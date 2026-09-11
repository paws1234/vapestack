"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { parseDemoOrder, readDemoOrderRaw } from "@/lib/demo-order";

/** There is nothing to subscribe to: the receipt is written once, before this page is opened. */
function subscribe(): () => void {
  return () => {};
}

/** The server cannot read storage, so its answer is always "nothing there". */
function noReceiptOnServer(): null {
  return null;
}

/**
 * The receipt for a checkout that could not reach WooCommerce.
 *
 * No order was created, and this says so rather than implying one was. What it shows is the basket
 * the browser was about to send, which is why the lines come from the tab's own storage: there is
 * nothing on the server to read.
 */
export function DemoOrderSummary() {
  const raw = useSyncExternalStore(subscribe, readDemoOrderRaw, noReceiptOnServer);
  const order = parseDemoOrder(raw);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-sm font-medium text-neon-400">Demo mode</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink-50 sm:text-4xl">Nothing was ordered</h1>
      <p className="mt-3 text-ink-200">
        WooCommerce could not be reached, so no order was created and no stock moved. What follows is
        the basket this browser was about to send, kept in this tab only.
      </p>

      {order ? (
        <>
          <ul className="mt-8 divide-y divide-ink-800 rounded-3xl border border-ink-800 bg-ink-900 px-6">
            {order.items.map((line, index) => (
              <li key={`${line.name}-${index}`} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-ink-50">{line.name}</p>

                  {line.options?.length ? (
                    <p className="text-sm text-ink-400">{line.options.join(" · ")}</p>
                  ) : null}

                  <p className="text-sm text-ink-400">Quantity {line.quantity}</p>
                </div>
                <Price min={line.total} max={line.total} className="shrink-0 text-ink-50" />
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between rounded-3xl border border-ink-800 bg-ink-900 px-6 py-4">
            <span className="text-ink-200">Total</span>
            <Price min={order.total} max={order.total} className="text-lg font-semibold text-neon-400" />
          </div>
        </>
      ) : (
        <p className="mt-8 rounded-3xl border border-ink-800 bg-ink-900 px-6 py-4 text-ink-400">
          This tab has no demo receipt to show.
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shop" className={buttonStyles("primary", "md")}>
          Back to the shop
        </Link>
        <Link href="/" className={buttonStyles("outline", "md")}>
          Home
        </Link>
      </div>
    </div>
  );
}
