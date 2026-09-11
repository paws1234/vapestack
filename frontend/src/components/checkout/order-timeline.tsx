"use client";

import { useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LAST_STAGE,
  TIMELINE_STAGES,
  clampStage,
  noStoredStage,
  readStageRaw,
  subscribeToTimeline,
  writeStage,
} from "@/lib/order-timeline";

/**
 * The order's four stages, and a control that moves them along.
 *
 * Rendered on both paths - the real order page and the demo receipt - because a shop that could not
 * be reached still owes the visitor the same explanation as one that could.
 *
 * Three things are deliberate:
 *
 * - **Exactly one stage carries `aria-current="step"`**, and reached stages also carry a drawn tick
 *   rather than only a colour, so progress is readable without seeing the palette.
 * - **The reviewer control is not part of the order.** It is a dashed-outline button with its own
 *   label and its own sentence saying what it is, sitting in its own block below the stages. It
 *   writes to `localStorage` and issues no request at all: the WooCommerce order is never updated.
 * - **The log is the live region.** The stage list changes too, but announcing the whole list on
 *   every step would be noise; the log is where a new line lands, so that is what speaks.
 *
 * Nothing here animates, so there is no `motion-reduce:` neighbour to write. The copy says the
 * tracking is a simulation, in the same voice the footer uses: no courier, no tracking number, no
 * arrival date and no map, because none of those exist.
 *
 * @param props.orderId   A WooCommerce order id, or `demo` for the receipt that has none, so two
 *                        orders never share a stage.
 * @param props.startStage Where the order's own status puts it: 0 for a fresh order, the last
 *                        stage for a completed one.
 */
export function OrderTimeline({
  orderId,
  startStage,
}: {
  orderId: string;
  startStage: number;
}) {
  /*
    The stored stage, read through `useSyncExternalStore` so the server render and the hydration
    render both use `noStoredStage()` and agree with each other. Reading `localStorage` during a
    render would be the hydration mismatch the demo receipt already avoids the same way.
  */
  const stored = useSyncExternalStore(
    subscribeToTimeline,
    () => readStageRaw(orderId),
    noStoredStage,
  );

  /* The order's own status is a floor: a persisted stage can move an order forward, never back. */
  const current = clampStage(Math.max(null === stored ? 0 : Number.parseInt(stored, 10), startStage));

  /** Lines the reviewer has added this visit. Not persisted: the stage is, the log is a record. */
  const [log, setLog] = useState<string[]>([]);

  const atLastStage = current >= LAST_STAGE;

  /** Moves the simulation one stage on, and logs it. Writes nothing anywhere but this browser. */
  function advance(): void {
    if (atLastStage) {
      return;
    }

    const next = clampStage(current + 1);
    const at = new Date().toLocaleTimeString("en-GB", { hour12: false });

    writeStage(orderId, next);

    setLog((lines) => [...lines, `${TIMELINE_STAGES[next].label} — simulated at ${at}`]);
  }

  return (
    <section
      data-timeline-current={current}
      data-timeline-stages={TIMELINE_STAGES.length}
      data-timeline-order={orderId}
      className="mt-8 rounded-3xl border border-ink-800 bg-ink-900 p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink-50">Where the order would be</h2>
        <Badge tone="muted">Simulation</Badge>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-200">
        A demonstration of post-purchase tracking. Nothing ships from this shop, so there is no
        courier, no tracking number and no delivery date — the stages show what tracking would look
        like, and the control below moves them along so the states can be seen.
      </p>

      <ol className="mt-5 space-y-4">
        {TIMELINE_STAGES.map((stage, index) => {
          const isCurrent = index === current;
          const reached = index <= current;

          return (
            <li
              key={stage.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex gap-3"
            >
              {/*
                A glyph, not a colour: three shapes distinguish done, current and not yet, and the
                sentence after the label says the same thing again in words.
              */}
              <span
                aria-hidden="true"
                className={[
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                  reached ? "border-neon-400 text-neon-400" : "border-line text-ink-400",
                ].join(" ")}
              >
                {reached ? "✓" : index + 1}
              </span>

              <span className="min-w-0">
                <span className={`block ${isCurrent ? "text-neon-400" : reached ? "text-ink-50" : "text-ink-400"}`}>
                  {stage.label}
                </span>

                <span className="block text-xs leading-relaxed text-ink-400">{stage.note}</span>

                <span className="sr-only">
                  {isCurrent ? " — current stage" : reached ? " — already reached" : " — not yet"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 border-t border-ink-800 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={advance}
          disabled={atLastStage}
          /* Dashed, so the reviewer control cannot be mistaken for part of the order's own state. */
          className="border-dashed"
        >
          {atLastStage ? "Every stage reached" : "Simulate the next step"}
        </Button>

        <p className="mt-2 text-xs leading-relaxed text-ink-400">
          A reviewer control, not part of the order: it moves this browser&rsquo;s copy along and
          changes nothing in WooCommerce.
        </p>
      </div>

      <div className="mt-4 border-t border-ink-800 pt-4">
        <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Status log</p>

        <ol aria-live="polite" className="mt-2 space-y-1 text-sm text-ink-200">
          {log.map((line, index) => (
            <li key={index} className="tabular-nums">
              {line}
            </li>
          ))}
        </ol>

        {0 === log.length ? (
          <p className="mt-2 text-sm text-ink-400">
            No simulated movement yet — the order is where it started.
          </p>
        ) : null}
      </div>
    </section>
  );
}
