/**
 * The contact form's rules, as one pure module.
 *
 * Pure, and imported by both sides on purpose: the browser reads it to catch a typo before a
 * request is made, and `POST /api/contact` reads it again as the authority. Two copies of "what a
 * valid message is" is how a client and a server come to disagree about it.
 *
 * Nothing here knows about HTTP, email or the DOM. The wire format lives in `contact-mail.ts`,
 * which is server-only; the fallback link is built here because it is only text.
 */

import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Longest each field may be.
 *
 * The message cap is a mail-sized one rather than a database one: this text becomes the body of an
 * email, and nothing stores it. The address cap is RFC 5321's own limit.
 */
export const CONTACT_LIMITS = { name: 80, email: 254, message: 4000 } as const;

/** Shortest a message may be, so "hi" is caught here instead of arriving as an email. */
const MIN_MESSAGE = 10;

/**
 * The field a bot fills in and a person never sees.
 *
 * A name no autofill profile recognises, because the failure mode of a honeypot is a real person's
 * browser filling it in and their message being dropped.
 */
export const HONEYPOT_FIELD = "vapestack-contact-extra";

/** A message, trimmed and ready to send. */
export type ContactMessage = { name: string; email: string; message: string };

/** One reason per field, so the form can point at the control that is wrong. */
export type ContactErrors = Partial<Record<keyof ContactMessage, string>>;

/** Either a message, or why there is not one yet. */
export type ContactResult =
  | { ok: true; message: ContactMessage }
  | { ok: false; errors: ContactErrors };

/** Enough of a shape check to catch a typo — the same test the checkout route makes. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A control character has no legitimate place in a name or an address, and a hostile one: a line
 * break is how a value escapes whatever it was meant to be a value *of*. The message may wrap, so
 * only its carriage returns are normalised away.
 */
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Reads a field, treating anything that is not a string as absent.
 *
 * @param value Whatever arrived under that name.
 */
function text(value: unknown): string {
  return "string" === typeof value ? value.trim() : "";
}

/**
 * Validates one submission.
 *
 * Every problem is reported at once rather than one at a time, because a form that reveals its
 * rules one rejection at a time is a form that gets filled in twice.
 *
 * @param input The three fields, as they arrived from the form or the request body.
 */
export function readContactMessage(input: {
  name?: unknown;
  email?: unknown;
  message?: unknown;
}): ContactResult {
  const name = text(input.name);
  const email = text(input.email);
  const message = text(input.message).replace(/\r\n?/g, "\n");
  const errors: ContactErrors = {};

  if ("" === name) {
    errors.name = "A name is required.";
  } else if (name.length > CONTACT_LIMITS.name) {
    errors.name = `Keep the name under ${CONTACT_LIMITS.name} characters.`;
  } else if (CONTROL.test(name)) {
    errors.name = "That name contains characters a name cannot contain.";
  }

  if ("" === email) {
    errors.email = "An email address is required, so I can reply.";
  } else if (email.length > CONTACT_LIMITS.email) {
    errors.email = "That email address is too long.";
  } else if (!EMAIL.test(email) || CONTROL.test(email)) {
    errors.email = "That email address does not look right.";
  }

  if ("" === message) {
    errors.message = "A message is required.";
  } else if (message.length < MIN_MESSAGE) {
    errors.message = `A little more detail, please — at least ${MIN_MESSAGE} characters.`;
  } else if (message.length > CONTACT_LIMITS.message) {
    errors.message = `Keep the message under ${CONTACT_LIMITS.message} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, message: { name, email, message } };
}

/**
 * The subject every contact email carries.
 *
 * Fixed, not built from what was typed: a subject is a header, and a header is not somewhere a
 * visitor's text belongs.
 */
export const CONTACT_SUBJECT = "New message from the Vapestack site";

/**
 * The body of the email, in plain text.
 *
 * Plain text rather than HTML, which is the whole of the injection defence: there is no markup for
 * anything typed into the form to be interpreted as.
 *
 * @param message The validated message.
 */
export function composeContactBody(message: ContactMessage): string {
  return [
    `Name:  ${message.name}`,
    `Email: ${message.email}`,
    "",
    message.message,
    "",
    "--",
    "Sent from the contact form on the Vapestack storefront. Reply to this email to answer directly.",
  ].join("\n");
}

/**
 * The same message as a link for the visitor's own mail client.
 *
 * This is what the form falls back to when no mail provider is configured, or when the send fails:
 * a message that has been typed is not thrown away, and the visitor does not retype it into an
 * address they would have to copy by hand. `mailto:` has no length guarantee, so an unusually long
 * message may be truncated by the mail client that opens it — the direct address is always beside
 * this link for exactly that reason.
 *
 * @param message The validated message.
 */
export function composeMailto(message: ContactMessage): string {
  const subject = encodeURIComponent(CONTACT_SUBJECT);
  const body = encodeURIComponent(`${message.message}\n\n— ${message.name} (${message.email})`);

  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}
