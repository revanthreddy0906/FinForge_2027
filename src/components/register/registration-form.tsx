"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useMemo,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import { registerAction } from "@/app/register/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { fieldName } from "@/lib/registration/form-data";
import { initialRegisterResult, type RegisterResult } from "@/lib/registration/register";
import {
  fieldErrorsFrom,
  limits,
  duplicateEmailErrors,
  registrationSchema,
  type FieldErrors,
} from "@/lib/registration/schema";
import { PaymentStep } from "./payment-step";
import { Turnstile } from "./turnstile";

/**
 * A team that is saved but not paid keeps its key for this tab, so after a reload, submitting
 * again reopens the same team's payment instead of hitting "name held". Storage can fail
 * (private mode), in which case this is simply skipped.
 */
const PENDING_KEY = "finforge-pending-registration";
function pendingKey(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}
function rememberPendingKey(key: FormDataEntryValue | null) {
  try {
    if (typeof key === "string") sessionStorage.setItem(PENDING_KEY, key);
  } catch {
    // ignore
  }
}
function forgetPendingKey() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function ConfirmedView({ reference, teamName }: { reference: string; teamName: string }) {
  // The view replaces the form, so focus its heading once it mounts.
  const focusOnMount = useCallback((el: HTMLHeadingElement | null) => el?.focus(), []);
  return (
    <section
      aria-labelledby="success-title"
      className="flex flex-col gap-lg border border-border-frame p-lg md:p-2xl"
    >
      <p className="text-eyebrow text-text-success uppercase">Registration confirmed</p>
      <h2
        id="success-title"
        ref={focusOnMount}
        tabIndex={-1}
        className="font-display text-heading-2 text-text-primary"
      >
        {teamName} is in.
      </h2>
      <div className="flex flex-col gap-xs">
        <p className="text-body text-text-secondary">Your team reference</p>
        <p className="font-display text-numeral text-text-accent" data-testid="team-reference">
          {reference}
        </p>
      </div>
      <p className="max-w-[40rem] text-body text-text-secondary">
        Your payment is received. Save this reference or take a screenshot. You&apos;ll need it if
        you contact us about your registration. We&apos;ll share event updates with the team leader
        by email.
      </p>
      <div>
        <Link href="/" className="text-label text-text-accent underline underline-offset-4">
          Back to the home page
        </Link>
      </div>
    </section>
  );
}

interface Member {
  key: number;
  fullName: string;
  email: string;
}

interface Values {
  teamName: string;
  institution: string;
  leaderPhone: string;
  consent: boolean;
  members: Member[];
}

/** Stand-in key for client-side checks; the real key is added when the form is submitted. */
const VALIDATION_KEY = "00000000-0000-4000-8000-000000000000";

/**
 * Client-side check of the whole form. Repeated emails are checked separately so they show
 * even while other fields are still empty (Zod skips object refinements until fields pass).
 */
function validate(v: Values): FieldErrors {
  const parsed = registrationSchema.safeParse(toInput(v, VALIDATION_KEY));
  const errors = new Map(parsed.success ? [] : fieldErrorsFrom(parsed.error));
  for (const [path, message] of duplicateEmailErrors(v.members)) {
    if (!errors.has(path)) errors.set(path, message);
  }
  return errors;
}

const emptyMember = (key: number): Member => ({ key, fullName: "", email: "" });

function toInput(v: Values, idempotencyKey: string) {
  return {
    teamName: v.teamName,
    institution: v.institution,
    leaderPhone: v.leaderPhone,
    consent: v.consent,
    idempotencyKey,
    members: v.members.map(({ fullName, email }) => ({ fullName, email })),
  };
}

/** Field paths in on-screen order, used to focus the first error. */
function orderedPaths(count: number): string[] {
  const paths = ["teamName", "institution"];
  for (let i = 0; i < count; i++)
    paths.push(`members.${String(i)}.fullName`, `members.${String(i)}.email`);
  paths.push("leaderPhone", "consent");
  return paths;
}

/** "Team leader: " / "Member 3: " before member errors in the summary, so repeats are clear. */
function summaryPrefix(path: string): string {
  const match = /^members\.(\d+)\./.exec(path);
  if (!match) return "";
  const i = Number(match[1]);
  return i === 0 ? "Team leader: " : `Member ${String(i + 1)}: `;
}

const inputId = (path: string) => `f-${path.replace(/\./g, "-")}`;

export function RegistrationForm({ siteKey }: { siteKey: string }) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const [serverErrors, setServerErrors] = useState<FieldErrors>(new Map());
  const [summary, setSummary] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ reference: string; teamName: string } | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const [result, formAction, isPending] = useActionState(
    async (previous: RegisterResult, fd: FormData) => {
      const next = await registerAction(previous, fd);
      if (next.status === "payment") rememberPendingKey(fd.get(fieldName.idempotencyKey));
      if (next.status === "success") forgetPendingKey();
      if (next.status === "error") {
        setServerErrors(next.fieldErrors);
        setSummary(next.message);
        setResetSignal((n) => n + 1); // a Turnstile token works once
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
      return next;
    },
    initialRegisterResult,
  );
  // One key per form, created on the first submit (not during render, so the page can be
  // prerendered). Retries reuse it, so a double click or resend can never create two teams.
  const idempotencyKey = useRef<string | null>(null);
  const [values, setValues] = useState<Values>(() => ({
    teamName: "",
    institution: "",
    leaderPhone: "",
    consent: false,
    members: [emptyMember(0), emptyMember(1)],
  }));
  const nextKey = useRef(2);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [turnstileFailed, setTurnstileFailed] = useState(false);

  const clientErrors = useMemo(() => validate(values), [values]);

  const update = (change: (v: Values) => Values, path?: string) => {
    setValues(change);
    if (path) {
      setServerErrors((prev) => {
        if (!prev.has(path)) return prev;
        const rest = new Map(prev);
        rest.delete(path);
        return rest;
      });
    }
  };

  /**
   * Shows a field's error once the person has typed in it and moved on. Leaving a field empty
   * doesn't count: "required" errors wait for submit, so passing through empty fields (or
   * clicking "Add a member") never makes the layout jump under the pointer.
   */
  const touch = (path: string, value: string) => {
    if (!value.trim()) return;
    setTouched((prev) => (prev.has(path) ? prev : new Set(prev).add(path)));
  };

  const errorFor = (path: string): string | undefined =>
    serverErrors.get(path) ?? (submitted || touched.has(path) ? clientErrors.get(path) : undefined);

  const setMember = (index: number, field: "fullName" | "email", value: string) => {
    update(
      (v) => ({
        ...v,
        members: v.members.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
      }),
      `members.${String(index)}.${field}`,
    );
  };

  const addMember = () => {
    const key = nextKey.current++;
    update((v) => ({ ...v, members: [...v.members, emptyMember(key)] }));
    const newIndex = values.members.length;
    requestAnimationFrame(() =>
      document.getElementById(inputId(`members.${String(newIndex)}.fullName`))?.focus(),
    );
  };

  const removeMember = (index: number) => {
    update((v) => ({ ...v, members: v.members.filter((_, i) => i !== index) }));
    setServerErrors(new Map());
    setTouched((prev) => new Set([...prev].filter((p) => !p.startsWith("members."))));
    requestAnimationFrame(() => document.getElementById("add-member")?.focus());
  };

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    const errors = clientErrors;
    const firstError = orderedPaths(values.members.length).find((p) => errors.has(p));
    if (firstError) {
      setSummary("Some details need fixing. Check the highlighted fields.");
      requestAnimationFrame(() => document.getElementById(inputId(firstError))?.focus());
      return;
    }
    if (!token) {
      setSummary(
        turnstileFailed
          ? "The security check couldn't load. Check your connection, refresh the page and try again."
          : "Please wait for the security check below to finish, then submit again.",
      );
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSummary(null);
    idempotencyKey.current ??= pendingKey() ?? crypto.randomUUID();
    const fd = new FormData(e.currentTarget);
    fd.set(fieldName.idempotencyKey, idempotencyKey.current);
    startTransition(() => {
      formAction(fd);
    });
  };

  if (paid) {
    return <ConfirmedView reference={paid.reference} teamName={paid.teamName} />;
  }
  if (result.status === "success") {
    return <ConfirmedView reference={result.reference} teamName={result.teamName} />;
  }
  if (result.status === "payment") {
    return (
      <PaymentStep
        payment={result.payment}
        onPaid={(reference, teamName) => {
          forgetPendingKey();
          setPaid({ reference, teamName });
        }}
      />
    );
  }

  const memberCount = values.members.length;
  const summaryErrors = orderedPaths(memberCount)
    .map((p) => [p, errorFor(p)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));

  return (
    // method="post": if someone submits before the page's JavaScript has loaded (slow phone
    // networks), the browser must not fall back to GET, which would put names, emails and
    // the mobile number in the URL and the server logs.
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      aria-describedby="privacy-note"
      className="flex flex-col gap-2xl"
    >
      <div
        id="form-errors"
        ref={summaryRef}
        tabIndex={-1}
        role="alert"
        className={
          summary ? "flex scroll-mt-28 flex-col gap-sm border border-border-danger p-md" : "sr-only"
        }
      >
        {summary && (
          <>
            <p className="text-label text-text-danger">{summary}</p>
            {summaryErrors.length > 0 && (
              <ul className="flex list-disc flex-col gap-2xs pl-lg text-body-sm text-text-primary">
                {summaryErrors.map(([path, message]) => (
                  <li key={path}>
                    <a href={`#${inputId(path)}`} className="underline underline-offset-4">
                      {summaryPrefix(path)}
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <fieldset className="flex flex-col gap-lg">
        <legend className="mb-lg font-display text-heading-3 text-text-primary">Your team</legend>
        <Field
          id={inputId("teamName")}
          name={fieldName.teamName}
          label="Team name"
          required
          autoComplete="off"
          maxLength={limits.teamName.max}
          value={values.teamName}
          onChange={(e) => {
            update((v) => ({ ...v, teamName: e.target.value }), "teamName");
          }}
          onBlur={(e) => {
            touch("teamName", e.target.value);
          }}
          error={errorFor("teamName")}
        />
        <Field
          id={inputId("institution")}
          name={fieldName.institution}
          label="College"
          hint="Full name of the college your team studies at."
          required
          autoComplete="organization"
          maxLength={limits.institution.max}
          value={values.institution}
          onChange={(e) => {
            update((v) => ({ ...v, institution: e.target.value }), "institution");
          }}
          onBlur={(e) => {
            touch("institution", e.target.value);
          }}
          error={errorFor("institution")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-lg">
        <legend className="mb-xs font-display text-heading-3 text-text-primary">Members</legend>
        <p className="text-body text-text-secondary">
          {limits.members.min} to {limits.members.max} people, including you. Each person can be in
          one team only.
        </p>
        <ol className="flex flex-col gap-xl">
          {values.members.map((m, i) => {
            const label = i === 0 ? "Team leader (you)" : `Member ${String(i + 1)}`;
            const nameKey = `members.${String(i)}.fullName`;
            const emailKey = `members.${String(i)}.email`;
            return (
              <li key={m.key}>
                <fieldset className="flex flex-col gap-md border-l border-border-frame pl-md md:pl-lg">
                  <legend className="mb-md flex w-full items-center justify-between gap-md text-label text-text-accent">
                    <span>{label}</span>
                  </legend>
                  <Field
                    id={inputId(nameKey)}
                    name={fieldName.memberName(i)}
                    label="Full name"
                    required
                    autoComplete={i === 0 ? "name" : "off"}
                    maxLength={limits.fullName.max}
                    value={m.fullName}
                    onChange={(e) => {
                      setMember(i, "fullName", e.target.value);
                    }}
                    onBlur={(e) => {
                      touch(nameKey, e.target.value);
                    }}
                    error={errorFor(nameKey)}
                  />
                  <Field
                    id={inputId(emailKey)}
                    name={fieldName.memberEmail(i)}
                    label="Email"
                    type="email"
                    inputMode="email"
                    required
                    autoComplete={i === 0 ? "email" : "off"}
                    maxLength={limits.email.max}
                    value={m.email}
                    onChange={(e) => {
                      setMember(i, "email", e.target.value);
                    }}
                    onBlur={(e) => {
                      touch(emailKey, e.target.value);
                    }}
                    error={errorFor(emailKey)}
                  />
                  {i === 0 && (
                    <Field
                      id={inputId("leaderPhone")}
                      name={fieldName.leaderPhone}
                      label="Mobile number"
                      hint="Indian mobile number. We'll only call about the event."
                      type="tel"
                      inputMode="tel"
                      required
                      autoComplete="tel-national"
                      maxLength={20}
                      value={values.leaderPhone}
                      onChange={(e) => {
                        update((v) => ({ ...v, leaderPhone: e.target.value }), "leaderPhone");
                      }}
                      onBlur={(e) => {
                        touch("leaderPhone", e.target.value);
                      }}
                      error={errorFor("leaderPhone")}
                    />
                  )}
                  {i >= limits.members.min && (
                    <div>
                      <Button
                        variant="ghost"
                        className="min-h-11 px-0"
                        onClick={() => {
                          removeMember(i);
                        }}
                        aria-label={`Remove member ${String(i + 1)}`}
                      >
                        Remove member
                      </Button>
                    </div>
                  )}
                </fieldset>
              </li>
            );
          })}
        </ol>
        {memberCount < limits.members.max ? (
          <div>
            <Button id="add-member" variant="secondary" onClick={addMember}>
              Add a member ({memberCount} of {limits.members.max})
            </Button>
          </div>
        ) : (
          <p id="add-member" tabIndex={-1} className="text-body-sm text-text-secondary">
            Your team is at the maximum of {limits.members.max} members.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-lg">
        <legend className="mb-lg font-display text-heading-3 text-text-primary">
          Privacy and security
        </legend>
        <div
          id="privacy-note"
          className="flex flex-col gap-sm bg-bg-surface p-md text-body-sm text-text-secondary"
        >
          <p className="text-label text-text-primary">What we store and why</p>
          <p>
            We store your team name, college, each member&apos;s name and email, and the team
            leader&apos;s mobile number. We use them only to run FinForge 2027: to confirm your
            place, send event updates and check you in on the day. Only the organising team can see
            them, and we delete them after the event.
          </p>
        </div>
        <div className="flex flex-col gap-xs">
          <label
            htmlFor={inputId("consent")}
            className="flex min-h-12 cursor-pointer items-start gap-sm"
          >
            <input
              id={inputId("consent")}
              name={fieldName.consent}
              type="checkbox"
              className="mt-0.5 size-6 shrink-0 accent-(--color-bg-accent)"
              checked={values.consent}
              aria-invalid={errorFor("consent") ? true : undefined}
              aria-describedby={errorFor("consent") ? `${inputId("consent")}-error` : undefined}
              onChange={(e) => {
                update((v) => ({ ...v, consent: e.target.checked }), "consent");
                touch("consent", "on");
              }}
            />
            <span className="text-body text-text-primary">
              I&apos;ve read the privacy note, and my team members agree to share these details.
            </span>
          </label>
          {errorFor("consent") && (
            <p
              id={`${inputId("consent")}-error`}
              className="flex gap-xs text-body-sm text-text-danger"
            >
              <span aria-hidden="true">!</span>
              <span>{errorFor("consent")}</span>
            </p>
          )}
        </div>
        <Turnstile
          siteKey={siteKey}
          resetSignal={resetSignal}
          onToken={(t) => {
            setToken(t);
          }}
          onLoadError={() => {
            setTurnstileFailed(true);
          }}
        />
      </fieldset>

      <div className="flex flex-col items-start gap-sm">
        <Button type="submit" arrow={!isPending} disabled={isPending} aria-disabled={isPending}>
          {isPending ? "Registering your team…" : "Register team"}
        </Button>
        <p className="text-body-sm text-text-muted" aria-live="polite">
          {isPending ? "This can take a few seconds. Please don't close the page." : ""}
        </p>
      </div>
    </form>
  );
}
