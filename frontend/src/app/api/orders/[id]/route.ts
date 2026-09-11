/**
 * One order, as anything on the browser side of the app may see it.
 *
 * The route is public and unauthenticated, so an id is all it takes to read it. That is why the
 * summary carries no order key, no billing details and no customer note: what is not returned
 * cannot be enumerated.
 */

import { getOrderSummary } from "@/lib/wp/rest";

/*
 * An order is read at the moment it is asked for, never prerendered: the success page follows an
 * order that was created seconds ago.
 */
export const dynamic = "force-dynamic";

type OrderRouteProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reads one order's summary.
 *
 * @param _request Unused; the id is in the path.
 * @param props.params Route parameters carrying the order id.
 */
export async function GET(_request: Request, { params }: OrderRouteProps) {
  const { id } = await params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId < 1) {
    return Response.json({ error: "An order id is a positive whole number." }, { status: 400 });
  }

  try {
    const order = await getOrderSummary(orderId);

    return order
      ? Response.json(order)
      : Response.json({ error: `No order ${orderId}.` }, { status: 404 });
  } catch (error) {
    console.error(`Reading order ${orderId} failed.`, error);

    return Response.json({ error: "The order could not be read." }, { status: 502 });
  }
}
