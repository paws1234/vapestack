/**
 * Receives the contact form and emails it.
 *
 * The one route on this site that sends anything anywhere, and the only one that carries a
 * visitor's own words into the world. Three things follow from that:
 *
 * - **Nothing is trusted.** The fields are validated by `lib/contact.ts`, the same module the
 *   browser validates with, and the body of the email is built from the validated copy rather than
 *   from the request. The subject is fixed, because a subject is a header.
 * - **Nothing is stored.** The message is not written to WordPress, to a file or to a queue; it
 *   exists as an email. That is why this route reads no catalogue and needs no database.
 * - **The failure that matters is "not sent".** With no mail provider configured it answers 503 and
 *   says so, rather than pretending: the form then offers the visitor's own mail client instead of
 *   losing what they wrote.
 */

import { HONEYPOT_FIELD, readContactMessage } from "@/lib/contact";
import { sendContactMessage } from "@/lib/contact-mail";

/*
 * One message per request, so this route may never be prerendered. Nor may it be cached: two
 * identical submissions are two messages, not one served twice.
 */
export const dynamic = "force-dynamic";

/** How many messages one connection may send inside the window below. */
const MAX_PER_WINDOW = 5;

/** The window the count is made over. */
const WINDOW_MS = 10 * 60 * 1000;

/**
 * A best-effort throttle, per connection, held in this process's memory.
 *
 * Honest about what it is: on a serverless host every instance keeps its own map and a cold start
 * forgets it, so this raises the cost of a scripted flood rather than preventing one. A limit that
 * actually holds would need a shared store, which is more machinery than a portfolio's contact form
 * is worth. The honeypot does the cheap work; this catches the lazy repeat.
 */
const recent = new Map<string, number[]>();

/**
 * Records a submission and says whether this connection has made too many.
 *
 * @param ip The caller's address, or null when the host tells us nothing about it.
 */
function throttled(ip: string | null): boolean {
  if (!ip) {
    return false;
  }

  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);

  /* Without this the map is a slow leak on a long-lived instance. */
  if (recent.size > 500) {
    for (const [key, times] of recent) {
      if (times.every((at) => now - at >= WINDOW_MS)) {
        recent.delete(key);
      }
    }
  }

  return hits.length > MAX_PER_WINDOW;
}

/**
 * Takes a submission.
 *
 * @param request A JSON body of `name`, `email`, `message` and the honeypot field.
 */
export async function POST(request: Request): Promise<Response> {
  let fields: Record<string, unknown>;

  try {
    const body: unknown = await request.json();

    if (null === body || "object" !== typeof body || Array.isArray(body)) {
      throw new Error("not an object");
    }

    fields = body as Record<string, unknown>;
  } catch {
    return Response.json({ error: "The message could not be read. Please try again." }, { status: 400 });
  }

  /*
    The trap is answered with the same 200 a real send gets, and before anything else: a bot told it
    failed learns what to change. The log line is the only trace it leaves, which is what makes a
    message a person accidentally filled in recognisable as one.
  */
  const trap = fields[HONEYPOT_FIELD];

  if ("string" === typeof trap && "" !== trap) {
    console.warn("Contact: the honeypot field was filled in, so nothing was sent.");

    return Response.json({ sent: true });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  if (throttled(ip)) {
    return Response.json(
      { error: "That is a lot of messages in a short time. Please try again later." },
      { status: 429 },
    );
  }

  const result = readContactMessage(fields);

  if (!result.ok) {
    return Response.json(
      { error: "Check the highlighted fields.", errors: result.errors },
      { status: 400 },
    );
  }

  try {
    const sent = await sendContactMessage(result.message);

    if (!sent) {
      return Response.json(
        {
          error: "This deployment has no mail provider configured, so nothing was sent.",
          unconfigured: true,
        },
        { status: 503 },
      );
    }

    return Response.json({ sent: true });
  } catch (error) {
    /* The detail names the provider and what it objected to, which is diagnosis, not something a
       visitor can act on. It goes to the log and the visitor gets a sentence. */
    console.error("Contact: the message could not be sent.", error);

    return Response.json(
      { error: "The message could not be sent. Please try again, or email me directly." },
      { status: 502 },
    );
  }
}
