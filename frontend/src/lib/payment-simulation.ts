/**
 * The payment sandbox, as data and transitions.
 *
 * Pure and framework-free, like `cart-hold.ts` and `cart-rewards.ts`: the methods, the test cards
 * and the step machine are values and functions, so a component reads them instead of inventing
 * them. There are no timers here and nothing here touches storage, the network or a card number
 * beyond the moment it is validated.
 *
 * **No card digit ever leaves the browser.** `validateCard` reads the typed value, decides whether
 * it is a sandbox card and returns an outcome; the digits themselves are not returned, not stored
 * and never posted. `/api/checkout` receives a method id and nothing else.
 *
 * This is a simulation and every string that describes it says so, because the shop takes no
 * payment: the card numbers are published test numbers, the code is printed on the page, and the
 * receipt says the whole thing was a demonstration.
 */

/** The three ways this sandbox lets a visitor "pay". */
export type PaymentMethodId = "card" | "qr" | "cod";

/** One selectable method, and the record the shop keeps of it. */
export type PaymentMethod = {
  id: PaymentMethodId;
  /** Radio label. */
  label: string;
  /** One line under the label, in shop voice. */
  summary: string;
  /** What WooCommerce records in `payment_method`. Never shown to the browser. */
  slug: string;
  /** What WooCommerce records in `payment_method_title`, and what the receipt shows. */
  recorded: string;
};

/**
 * The methods, in the order the radio group shows them.
 *
 * The recorded titles all carry the word "simulated": the shop's own record must not read like a
 * real payment either, and T5 reads this exact string back out of WooCommerce with WP-CLI.
 */
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  {
    id: "card",
    label: "Card",
    summary: "A sandbox card number, with a simulated 3-D Secure step. Nothing is charged.",
    slug: "vapestack_card",
    recorded: "Simulated card payment (demo)",
  },
  {
    id: "qr",
    label: "QR payment",
    summary: "A real, scannable code — it points at this shop. No merchant account, so no charge.",
    slug: "vapestack_qr",
    recorded: "Simulated QR payment (demo)",
  },
  {
    id: "cod",
    label: "Cash on delivery",
    summary: "Simulated: nothing is dispatched, so there is nothing to pay for on arrival.",
    slug: "vapestack_cod",
    recorded: "Simulated cash on delivery (demo)",
  },
];

/** The method a fresh checkout starts on. */
export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = "card";

/** Ids as a lookup, so a posted value can be checked without walking the list. */
const BY_ID = new Map(PAYMENT_METHODS.map((method) => [method.id, method]));

/**
 * Whether a posted value is one of the methods this shop knows.
 *
 * The server's half of the contract: an unknown id is a 400, exactly as a bad quantity is, so the
 * browser cannot talk the API into a method it has never heard of.
 *
 * @param value Raw value from a request body or a store.
 */
export function isPaymentMethodId(value: unknown): value is PaymentMethodId {
  return "string" === typeof value && BY_ID.has(value as PaymentMethodId);
}

/**
 * The method behind an id.
 *
 * @param id One of {@link PAYMENT_METHODS}.
 */
export function paymentMethod(id: PaymentMethodId): PaymentMethod {
  /* Every id in the union is in the map, so this cannot be undefined. */
  return BY_ID.get(id) as PaymentMethod;
}

/* ------------------------------------------------------------------------------------------------
 * The card sandbox
 * ---------------------------------------------------------------------------------------------- */

/** What a sandbox card does when it is submitted. */
export type CardOutcome = "challenge" | "declined";

/** One published test number and what it produces. */
export type TestCard = {
  /** Number as it is printed on the page, in groups of four. */
  number: string;
  outcome: CardOutcome;
  /** What happens, in the words the page prints beside it. */
  result: string;
};

/**
 * The two sandbox cards.
 *
 * Prefix-matched rather than compared whole, so `4242…` reaches the challenge however the rest of
 * the digits are typed — which is what the plan's acceptance criteria describe.
 */
export const TEST_CARDS: readonly TestCard[] = [
  {
    number: "4242 4242 4242 4242",
    outcome: "challenge",
    result: "Challenges, then approves with the code below.",
  },
  {
    number: "4000 0000 0000 0002",
    outcome: "declined",
    result: "Declined by the simulated issuer. No order is created.",
  },
];

/** The code the challenge accepts, printed on the page and in the dialog. */
export const TEST_OTP = "123456";

/** How many digits a sandbox card has. */
const CARD_DIGITS = 16;

/** The leading digits that pick a sandbox card. Longer than four so `4000` cannot mean two things. */
const CHALLENGE_PREFIX = "4242";
const DECLINE_PREFIX = "4000";

/** Card fields as they are typed; the number and the code are never kept anywhere. */
export type CardFields = {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
};

/** What is wrong with a card, per field. An empty object means it can be submitted. */
export type CardErrors = Partial<Record<keyof CardFields, string>>;

/**
 * Keeps only the digits of a typed value.
 *
 * @param value Whatever is in the number or code field.
 */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Groups a card number in fours as it is typed, so a 16-digit string stays readable.
 *
 * @param value Digits, possibly with spaces already in them.
 */
export function formatCardNumber(value: string): string {
  return digitsOnly(value).slice(0, CARD_DIGITS).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Which sandbox card this is, or null when it is not one.
 *
 * @param digits Digits only, from {@link digitsOnly}.
 */
export function cardOutcome(digits: string): CardOutcome | null {
  if (digits.startsWith(CHALLENGE_PREFIX)) {
    return "challenge";
  }

  if (digits.startsWith(DECLINE_PREFIX)) {
    return "declined";
  }

  return null;
}

/**
 * Whether an expiry of the form `MM/YY` is in the future.
 *
 * `now` is passed in rather than read here so the answer is testable and so nothing in this module
 * holds a clock of its own.
 *
 * @param expiry Value as typed, e.g. `04/29`.
 * @param now    Current time in milliseconds.
 */
export function isFutureExpiry(expiry: string, now: number): boolean {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());

  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);

  if (month < 1 || month > 12) {
    return false;
  }

  const current = new Date(now);
  /* A card is good through the end of its month, so the comparison is month-granular. */
  const endOfMonth = new Date(year, month, 1).getTime();

  return endOfMonth > current.getTime();
}

/**
 * Checks a sandbox card, locally and only locally.
 *
 * Deliberately strict about which numbers it accepts: this is a sandbox with two published cards,
 * and a card the simulation cannot place an outcome for is a card it has no business pretending to
 * take. The digits are read here and dropped — nothing about the number survives this function
 * except the outcome, which the caller derives separately.
 *
 * @param fields Card fields as typed in the browser.
 * @param now    Current time in milliseconds, for the expiry check.
 */
export function validateCard(fields: CardFields, now: number): CardErrors {
  const errors: CardErrors = {};
  const digits = digitsOnly(fields.number);

  if ("" === fields.name.trim()) {
    errors.name = "The name on the card is needed for the simulation.";
  }

  if (CARD_DIGITS !== digits.length) {
    errors.number = `A sandbox card number is ${CARD_DIGITS} digits.`;
  } else if (null === cardOutcome(digits)) {
    errors.number = "This is a sandbox: use one of the test numbers printed above.";
  }

  if ("" === fields.expiry.trim()) {
    errors.expiry = "An expiry date is needed.";
  } else if (!isFutureExpiry(fields.expiry, now)) {
    errors.expiry = "Use a future date, in MM/YY.";
  }

  if (!/^\d{3,4}$/.test(fields.cvc.trim())) {
    errors.cvc = "The code is the 3 or 4 digits on the back.";
  }

  return errors;
}

/**
 * Whether a card is submittable.
 *
 * @param errors Result of {@link validateCard}.
 */
export function isCardValid(errors: CardErrors): boolean {
  return 0 === Object.keys(errors).length;
}

/* ------------------------------------------------------------------------------------------------
 * The step machine
 * ---------------------------------------------------------------------------------------------- */

/**
 * Where the payment is in its flow.
 *
 * Exposed as `data-state` on the checkout's payment block so an acceptance test reads a state
 * rather than guessing one from the DOM.
 */
export type PaymentStep =
  | "idle"
  | "validating"
  | "challenge"
  | "authorising"
  | "approved"
  | "declined";

/**
 * The transitions the flow may make.
 *
 * Written down rather than left to whichever `setState` a component happens to call, so a step
 * cannot be skipped by accident: `approved` only ever follows `authorising`, and `declined` is
 * reachable from `validating` (the issuer refused it outright) or from `authorising` (the
 * challenge passed and the authorisation failed).
 */
const TRANSITIONS: Record<PaymentStep, readonly PaymentStep[]> = {
  idle: ["validating"],
  validating: ["challenge", "authorising", "declined", "idle"],
  /* Cancelling the challenge returns to the form, so `idle` is reachable from here. */
  challenge: ["authorising", "idle"],
  /* A request the shop itself refused leaves the form usable again. */
  authorising: ["approved", "declined", "idle"],
  approved: [],
  /* A declined card is not a dead end: the visitor fixes the number and submits again. */
  declined: ["validating", "idle"],
};

/**
 * Whether one step may follow another.
 *
 * @param from Step the flow is in.
 * @param to   Step it wants to move to.
 */
export function canTransition(from: PaymentStep, to: PaymentStep): boolean {
  return TRANSITIONS[from].includes(to);
}

/** What the payment block says while it is in each step. Copy lives here so it cannot drift. */
export const STEP_MESSAGES: Record<PaymentStep, string> = {
  idle: "",
  validating: "Checking the card details in this browser…",
  challenge: "The simulated issuer wants a code before the payment can be authorised.",
  authorising: "Authorising the simulated payment…",
  approved: "The simulated payment was authorised.",
  declined: "The simulated issuer declined this card. No order was created and nothing was charged.",
};
