/**
 * Sends a contact message, and is the only file that knows how.
 *
 * Server-only: it reads `RESEND_API_KEY`, which must never reach the browser. Resend is called over
 * its HTTP API with `fetch`, so this costs the app no dependency.
 *
 * **Unconfigured is a state, not a failure.** With no key the storefront still has a contact page
 * and a real address; the route answers 503 and the form hands the written message to the visitor's
 * own mail client rather than swallowing it.
 *
 * The default sender is Resend's shared `onboarding@resend.dev`, which only delivers to the address
 * that owns the account — which is this site's own inbox. That makes a verified domain unnecessary
 * for exactly this use, and a `CONTACT_FROM_EMAIL` on a verified domain replaces it the moment one
 * exists. Nothing sends *from* the visitor's address: it is the reply-to, so replying from the inbox
 * still answers them.
 */

import { CONTACT_SUBJECT, composeContactBody, type ContactMessage } from "@/lib/contact";
import { CONTACT_EMAIL } from "@/lib/site";

/** The provider's send endpoint. */
const ENDPOINT = "https://api.resend.com/emails";

/** Used when `CONTACT_FROM_EMAIL` is unset, and only able to deliver to the account's own address. */
const DEFAULT_FROM = "Vapestack contact form <onboarding@resend.dev>";

/** What the provider is called with. */
export type ContactMailConfig = {
  apiKey: string;
  from: string;
  to: string;
};

/**
 * The provider settings, or `null` when this deployment has none.
 *
 * The destination defaults to {@link CONTACT_EMAIL} rather than requiring an environment variable:
 * the address the site publishes and the address the mail goes to are the same thing here, and two
 * places to configure one fact is one place too many.
 */
export function contactMailConfig(): ContactMailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    from: process.env.CONTACT_FROM_EMAIL?.trim() || DEFAULT_FROM,
    to: process.env.CONTACT_TO_EMAIL?.trim() || CONTACT_EMAIL,
  };
}

/** A refusal from the provider. The detail is for the log, never for the visitor. */
export class ContactMailError extends Error {}

/**
 * The exact request the provider is sent.
 *
 * Split out from the send so the payload can be asserted without a key and without an email being
 * delivered — a wrong field name here would otherwise only surface as somebody's first real message
 * quietly not arriving.
 *
 * @param message The validated message.
 * @param config  The provider settings.
 */
export function buildContactRequest(
  message: ContactMessage,
  config: ContactMailConfig,
): { url: string; init: RequestInit } {
  return {
    url: ENDPOINT,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        reply_to: message.email,
        subject: CONTACT_SUBJECT,
        text: composeContactBody(message),
      }),
    },
  };
}

/**
 * Sends it.
 *
 * @param message The validated message.
 * @returns `false` when no provider is configured — a state the caller reports, not an error.
 * @throws  {@link ContactMailError} when a configured provider refuses, and whatever `fetch` throws
 *          when it cannot be reached at all.
 */
export async function sendContactMessage(message: ContactMessage): Promise<boolean> {
  const config = contactMailConfig();

  if (!config) {
    return false;
  }

  const { url, init } = buildContactRequest(message, config);
  const response = await fetch(url, init);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    throw new ContactMailError(`${response.status} ${detail.slice(0, 300)}`);
  }

  return true;
}
