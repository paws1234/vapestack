"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * What a route shows when rendering it threw.
 *
 * A client component by necessity: `reset` is a handler, so this cannot run on the server. It is
 * the boundary for every route under the root layout — an error thrown by the root layout itself
 * is not caught here and keeps Next's own screen, which is the one limit of this file.
 *
 * The message is never rendered. A failed WordPress read can put an internal URL, and in the worst
 * case a credential, into an error message, and this page is public: only the digest is logged, and
 * that is the string that ties this view to the server log.
 *
 * @param props.error The thrown error, with the digest Next attaches for server-side matching.
 * @param props.reset Re-renders the failed segment without reloading the page.
 */
export default function RouteError({ error, reset }: RouteErrorProps) {
  const router = useRouter();

  useEffect(() => {
    console.error("Route error", error.digest ?? "(no digest)");
  }, [error]);

  /*
    Both, deliberately. Measured: `reset()` on its own re-renders the payload the browser already
    holds and issues no request at all, so an error thrown while rendering on the server comes
    straight back and the button looks dead. `router.refresh()` is the half that re-fetches the
    segment, and it is only worth anything if the fault has cleared by then.
  */
  function retry() {
    router.refresh();
    reset();
  }

  return (
    <Container width="narrow" className="py-16">
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.25em] text-danger">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink-50 sm:text-3xl">
          This page could not be rendered
        </h1>
        <p className="mt-4 text-ink-200">
          The storefront hit an unexpected error while building this page. The shop is still
          running, and nothing in your cart has been affected.
        </p>
        <p className="mt-3 text-ink-400">
          Trying again is usually enough. If it is not, the rest of the shop is unaffected.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={retry}>Try again</Button>
          <Link href="/shop" className={buttonStyles("outline", "md")}>
            Browse the shop
          </Link>
        </div>
      </div>
    </Container>
  );
}
