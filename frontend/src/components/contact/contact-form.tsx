"use client";

import { useState, type FormEvent } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, TextAreaField } from "@/components/ui/field";
import {
  CONTACT_LIMITS,
  HONEYPOT_FIELD,
  composeMailto,
  readContactMessage,
  type ContactErrors,
} from "@/lib/contact";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Where the form is in its one request.
 *
 * `no-provider` is deliberately not an error: nothing was refused and nothing is broken, there is
 * simply no mail provider configured on this deployment yet, so the message is handed to the
 * visitor's own mail client instead of being dropped.
 */
type State = "idle" | "sending" | "sent" | "no-provider" | "failed";

/**
 * The contact form.
 *
 * Uncontrolled, like the checkout form: React owns the outcome, the DOM owns what was typed, and
 * the fields are read from the form's own `FormData` at submit. That keeps a keystroke from
 * re-rendering anything, and it means the value that gets validated is the value that is on screen.
 *
 * Validation runs twice on purpose — here so a typo never becomes a request, and in the route as
 * the authority. Both call `readContactMessage`, so the two cannot disagree.
 *
 * A message is never silently lost. Every outcome other than "sent" leaves the visitor a link that
 * opens their own mail client with the message already written.
 */
export function ContactForm() {
  const [state, setState] = useState<State>("idle");
  const [errors, setErrors] = useState<ContactErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  /**
   * Validates what was typed and posts it.
   *
   * @param event The submit, which is always handled here.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const result = readContactMessage({
      name: data.get("name"),
      email: data.get("email"),
      message: data.get("message"),
    });

    if (!result.ok) {
      setErrors(result.errors);
      setState("idle");

      return;
    }

    setErrors({});
    setFailure(null);
    setFallback(null);
    setState("sending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...result.message,
          [HONEYPOT_FIELD]: data.get(HONEYPOT_FIELD),
        }),
      });

      if (response.ok) {
        form.reset();
        setState("sent");

        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; errors?: ContactErrors; unconfigured?: boolean }
        | null;

      if (payload?.errors) {
        setErrors(payload.errors);
        setState("idle");

        return;
      }

      /*
        Whatever went wrong, the visitor keeps the message: the same fields, already encoded, as a
        link their own mail client can open. A 503 is this deployment having no provider rather than
        anything they can retry away, so it says so.
      */
      setFallback(composeMailto(result.message));
      setFailure(payload?.error ?? "The message could not be sent. Please try again.");
      setState(payload?.unconfigured ? "no-provider" : "failed");
    } catch {
      setFallback(composeMailto(result.message));
      setFailure("The form could not reach the site. Check your connection and try again.");
      setState("failed");
    }
  }

  const invalid = (field: keyof ContactErrors): boolean => Boolean(errors[field]);
  const problems = Object.values(errors);

  return (
    <form onSubmit={onSubmit} noValidate data-state={state} className="space-y-5">
      {state === "sent" ? (
        <p
          role="status"
          className="rounded-2xl border border-neon-400/40 bg-ink-900 px-4 py-3 text-sm text-ink-50"
        >
          Sent. It is in my inbox now — nothing was stored here, and the reply goes to the address you
          gave.
        </p>
      ) : null}

      {state === "no-provider" || state === "failed" ? (
        <div
          role="alert"
          className="rounded-2xl border border-danger/40 bg-ink-900 px-4 py-3 text-sm text-ink-200"
        >
          <p className="text-danger">{failure}</p>
          <p className="mt-2">
            Your message is still here, so nothing needs typing twice:{" "}
            {fallback ? (
              <a href={fallback} className="text-neon-400 underline underline-offset-4 hover:text-neon-300">
                open it in your mail app
              </a>
            ) : null}
            {fallback ? ", or write to " : "Write to "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-neon-400 underline underline-offset-4 hover:text-neon-300"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      ) : null}

      {problems.length > 0 ? (
        <ul
          role="alert"
          className="rounded-2xl border border-danger/40 bg-ink-900 px-4 py-3 text-sm text-danger"
        >
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="contact-name"
          name="name"
          label="Your name"
          required
          autoComplete="name"
          aria-invalid={invalid("name")}
          className="sm:col-span-2"
        />

        <Field
          id="contact-email"
          name="email"
          label="Your email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={invalid("email")}
          className="sm:col-span-2"
        />

        <TextAreaField
          id="contact-message"
          name="message"
          label="Message"
          rows={6}
          required
          maxLength={CONTACT_LIMITS.message}
          aria-invalid={invalid("message")}
          placeholder="What would you like to ask about?"
          className="sm:col-span-2"
        />
      </div>

      {/*
        The trap: off-screen rather than `display: none`, because some bots skip what is not
        rendered; unreachable by keyboard and hidden from assistive technology, because its only job
        is to be invisible to a person. Its name is one no autofill profile recognises — the way a
        honeypot fails is by catching a real person's browser filling it in.
      */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0">
        <label htmlFor="contact-extra">Leave this field empty</label>
        <input id="contact-extra" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={"sending" === state}>
          {"sending" === state ? "Sending…" : "Send the message"}
        </Button>

        <a href={`mailto:${CONTACT_EMAIL}`} className={buttonStyles("outline", "lg")}>
          Email instead
        </a>
      </div>
    </form>
  );
}
