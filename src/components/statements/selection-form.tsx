"use client";

import { startTransition, useActionState, useCallback, useRef, useState } from "react";
import { submitSelectionAction } from "@/app/statements/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  selectionErrorsFrom,
  selectionField,
  selectionSchema,
  type SelectionErrors,
} from "@/lib/statements/schema";
import { formatSubmittedAt, initialSubmitResult, type SubmitResult } from "@/lib/statements/submit";

export interface StatementOption {
  id: number;
  title: string;
}

const ordinal = ["1st", "2nd", "3rd", "4th"] as const;
const choiceLabel = (index: number) => `${ordinal.at(index) ?? String(index + 1)} choice`;

function useFocusOnMount() {
  return useCallback((el: HTMLElement | null) => el?.focus(), []);
}

function DoneView({
  result,
}: {
  result: Extract<SubmitResult, { status: "submitted" | "already-submitted" }>;
}) {
  const focusOnMount = useFocusOnMount();
  const fresh = result.status === "submitted";
  return (
    <section
      aria-labelledby="done-title"
      className="flex flex-col gap-lg border border-border-frame p-lg md:p-2xl"
    >
      <p className={`text-eyebrow uppercase ${fresh ? "text-text-success" : "text-text-accent"}`}>
        {fresh ? "Choices received" : "Already submitted"}
      </p>
      <h2
        id="done-title"
        ref={focusOnMount}
        tabIndex={-1}
        className="font-display text-heading-2 text-text-primary"
      >
        {fresh ? "Your team's choices are in." : "Your team already has an entry."}
      </h2>
      <dl className="flex flex-col gap-sm">
        <div>
          <dt className="text-body text-text-secondary">Team reference</dt>
          <dd className="font-display text-heading-3 text-text-accent" data-testid="done-reference">
            {result.reference}
          </dd>
        </div>
        {result.submittedAt && (
          <div>
            <dt className="text-body text-text-secondary">Received at</dt>
            <dd className="text-body-lg text-text-primary tabular-nums" data-testid="done-time">
              {formatSubmittedAt(result.submittedAt)}
            </dd>
          </div>
        )}
      </dl>
      <p className="max-w-[40rem] text-body text-text-secondary">
        {fresh
          ? "Statements go to teams in the order their choices arrived. The organizers will publish every team's statement on the results page once selection closes."
          : "Each team can submit once, so nothing was changed. The organizers will publish every team's statement on the results page once selection closes."}
      </p>
      <div>
        <a
          href="/statements/results"
          className="text-label text-text-accent underline underline-offset-4"
        >
          Go to the results page
        </a>
      </div>
    </section>
  );
}

export function SelectionForm({ statements }: { statements: readonly StatementOption[] }) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const [reference, setReference] = useState("");
  const [order, setOrder] = useState<number[]>(() => statements.map((s) => s.id));
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [errors, setErrors] = useState<SelectionErrors>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const focusReview = useFocusOnMount();

  const titleOf = (id: number) => statements.find((s) => s.id === id)?.title ?? "";

  const [result, formAction, isPending] = useActionState(
    async (previous: SubmitResult, fd: FormData) => {
      const next = await submitSelectionAction(previous, fd);
      if (next.status === "error") {
        setErrors(next.fieldErrors);
        setSummary(next.message);
        setStep("edit");
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
      return next;
    },
    initialSubmitResult,
  );

  if (result.status === "submitted" || result.status === "already-submitted") {
    return <DoneView result={result} />;
  }

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    const moved = order.at(index);
    const other = order.at(target);
    if (moved === undefined || other === undefined || target < 0) return;
    setOrder(order.map((id, i) => (i === index ? other : i === target ? moved : id)));
    setAnnouncement(`${titleOf(moved)} is now your ${choiceLabel(target)}.`);
    // Keep focus on the same button of the item that moved, unless it reached the end.
    const direction = delta < 0 ? "up" : "down";
    const atEnd = target === 0 || target === order.length - 1;
    const focusId = atEnd
      ? `move-${delta < 0 ? "down" : "up"}-${String(moved)}`
      : `move-${direction}-${String(moved)}`;
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };

  const onReview = () => {
    const parsed = selectionSchema.safeParse({ reference, ranking: order });
    if (!parsed.success) {
      const found = selectionErrorsFrom(parsed.error);
      setErrors(found);
      setSummary("Some details need fixing. Check the highlighted fields.");
      requestAnimationFrame(() =>
        found.reference
          ? document.getElementById("f-reference")?.focus()
          : summaryRef.current?.focus(),
      );
      return;
    }
    setReference(parsed.data.reference);
    setErrors({});
    setSummary(null);
    setStep("review");
  };

  const onSubmit = () => {
    const fd = new FormData();
    fd.set(selectionField.reference, reference);
    fd.set(selectionField.ranking, order.join(","));
    startTransition(() => {
      formAction(fd);
    });
  };

  const errorList = [errors.reference, errors.ranking].filter(
    (e, i, all): e is string => Boolean(e) && all.indexOf(e) === i,
  );

  return (
    <div className="flex flex-col gap-2xl">
      <div
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
            {errorList.length > 0 && errorList[0] !== summary && (
              <ul className="flex list-disc flex-col gap-2xs pl-lg text-body-sm text-text-primary">
                {errorList.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {step === "edit" ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onReview();
          }}
          className="flex flex-col gap-2xl"
        >
          <fieldset className="flex flex-col gap-lg">
            <legend className="mb-lg font-display text-heading-3 text-text-primary">
              Your team
            </legend>
            <Field
              id="f-reference"
              label="Team reference"
              hint="Your team's own reference from registration, for example FF27-0080. Each team can submit only once, so type it carefully."
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setErrors((prev) => ({ ...prev, reference: undefined }));
              }}
              error={errors.reference}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-md" aria-describedby="ranking-hint">
            <legend className="mb-xs font-display text-heading-3 text-text-primary">
              Your order
            </legend>
            <p id="ranking-hint" className="text-body text-text-secondary">
              Put the statement your team wants most at the top. Use the arrows to move a statement
              up or down.
            </p>
            <ol className="flex flex-col gap-sm" data-testid="ranking">
              {order.map((id, i) => (
                <li
                  key={id}
                  className="flex items-center gap-md border border-border-default bg-bg-surface p-md"
                >
                  <span className="w-20 shrink-0 text-label text-text-accent">
                    {choiceLabel(i)}
                  </span>
                  <span className="flex-1 text-body text-text-primary">{titleOf(id)}</span>
                  <span className="flex shrink-0 gap-2xs">
                    <button
                      id={`move-up-${String(id)}`}
                      type="button"
                      disabled={i === 0}
                      onClick={() => {
                        move(i, -1);
                      }}
                      aria-label={`Move ${titleOf(id)} up`}
                      className="inline-flex size-12 items-center justify-center rounded-xs border border-border-strong text-text-primary hover:bg-bg-raised disabled:opacity-30"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      id={`move-down-${String(id)}`}
                      type="button"
                      disabled={i === order.length - 1}
                      onClick={() => {
                        move(i, 1);
                      }}
                      aria-label={`Move ${titleOf(id)} down`}
                      className="inline-flex size-12 items-center justify-center rounded-xs border border-border-strong text-text-primary hover:bg-bg-raised disabled:opacity-30"
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                  </span>
                </li>
              ))}
            </ol>
            <p aria-live="polite" className="sr-only">
              {announcement}
            </p>
            {errors.ranking && <p className="text-body-sm text-text-danger">{errors.ranking}</p>}
          </fieldset>

          <div>
            <Button type="submit" arrow>
              Review our choices
            </Button>
          </div>
        </form>
      ) : (
        <section
          aria-labelledby="review-title"
          className="flex flex-col gap-lg border border-border-frame p-lg md:p-2xl"
        >
          <h2
            id="review-title"
            ref={focusReview}
            tabIndex={-1}
            className="font-display text-heading-2 text-text-primary"
          >
            Check your choices
          </h2>
          <div className="flex flex-col gap-2xs">
            <p className="text-body text-text-secondary">Submitting for team</p>
            <p
              className="font-display text-heading-3 text-text-accent tabular-nums"
              data-testid="review-reference"
            >
              {reference}
            </p>
            <p className="text-body-sm text-text-secondary">
              Make sure this is your own team&apos;s reference.
            </p>
          </div>
          <ol className="flex flex-col gap-sm" data-testid="review-order">
            {order.map((id, i) => (
              <li key={id} className="flex gap-md text-body text-text-primary">
                <span className="w-20 shrink-0 text-label text-text-accent">{choiceLabel(i)}</span>
                <span>{titleOf(id)}</span>
              </li>
            ))}
          </ol>
          <p className="border-l-2 border-border-danger pl-md text-body text-text-primary">
            Your team can submit only once. After you submit, these choices can&apos;t be changed.
          </p>
          <div className="flex flex-wrap gap-sm">
            <Button onClick={onSubmit} disabled={isPending} aria-disabled={isPending}>
              {isPending ? "Submitting…" : "Submit our choices"}
            </Button>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => {
                setStep("edit");
              }}
            >
              Change the order
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
