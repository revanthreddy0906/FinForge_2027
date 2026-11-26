"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { event } from "@/config/event";
import { feeBreakdown, formatPaise } from "@/lib/payments/amount";
import { payCopy, verifyCopy, type VerifyResponse } from "@/lib/payments/copy";
import type { PaymentStart } from "@/lib/payments/flow";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** The parts of Razorpay Checkout we use. https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/ */
interface CheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface CheckoutInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: unknown) => void) => void;
}
type CheckoutConstructor = new (options: Record<string, unknown>) => CheckoutInstance;

declare global {
  interface Window {
    Razorpay?: CheckoutConstructor;
  }
}

let loading: Promise<CheckoutConstructor> | undefined;

/** Loads checkout.js once. Our nonced bundle adds it, which the CSP's 'strict-dynamic' allows. */
function loadCheckout(): Promise<CheckoutConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise<CheckoutConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay missing"));
    };
    script.onerror = () => {
      reject(new Error("checkout.js failed to load"));
    };
    document.head.appendChild(script);
  }).catch((e: unknown) => {
    loading = undefined;
    throw e;
  });
  return loading;
}

type Phase =
  | { kind: "ready" }
  | { kind: "opening" }
  | { kind: "open" }
  | { kind: "verifying" }
  | { kind: "problem"; message: string; canCheck: boolean };

async function verify(result: CheckoutSuccess): Promise<VerifyResponse> {
  try {
    const res = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    return (await res.json()) as VerifyResponse;
  } catch {
    return { status: "error", message: verifyCopy.error, retry: true };
  }
}

export function PaymentStep({
  payment,
  onPaid,
}: {
  payment: PaymentStart;
  onPaid: (reference: string, teamName: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [lastResult, setLastResult] = useState<CheckoutSuccess | null>(null);
  const failedOnce = useRef(false);
  const focusOnMount = useCallback((el: HTMLHeadingElement | null) => el?.focus(), []);
  const statusRef = useRef<HTMLDivElement>(null);
  const amount = formatPaise(payment.amountPaise);

  // Start fetching checkout.js as soon as the step shows, so the pop-up opens quickly.
  useEffect(() => {
    loadCheckout().catch(() => undefined);
  }, []);

  const confirm = async (result: CheckoutSuccess) => {
    setLastResult(result);
    setPhase({ kind: "verifying" });
    const answer = await verify(result);
    if (answer.status === "paid") {
      onPaid(answer.reference, answer.teamName);
      return;
    }
    setPhase({ kind: "problem", message: answer.message, canCheck: answer.retry });
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  const problem = (message: string) => {
    setPhase({ kind: "problem", message, canCheck: false });
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  const pay = async () => {
    failedOnce.current = false;
    setPhase({ kind: "opening" });
    let Checkout: CheckoutConstructor;
    try {
      Checkout = await loadCheckout();
    } catch {
      problem(payCopy.scriptFailed);
      return;
    }
    const checkout = new Checkout({
      key: payment.keyId,
      order_id: payment.orderId,
      amount: payment.amountPaise,
      currency: "INR",
      name: event.name,
      description: `Registration for ${payment.teamName} (${payment.reference})`,
      prefill: payment.prefill,
      notes: { team_reference: payment.reference },
      theme: { color: "#00665F" },
      handler: (result: CheckoutSuccess) => {
        void confirm(result);
      },
      modal: {
        ondismiss: () => {
          problem(failedOnce.current ? payCopy.failed : payCopy.dismissed);
        },
        confirm_close: true,
      },
    });
    checkout.on("payment.failed", () => {
      // Razorpay lets them retry inside the pop-up; the message shows if they close it afterwards.
      failedOnce.current = true;
    });
    setPhase({ kind: "open" });
    checkout.open();
  };

  const busy = phase.kind === "opening" || phase.kind === "verifying";

  return (
    <section
      aria-labelledby="payment-title"
      className="flex flex-col gap-lg border border-border-frame p-lg md:p-2xl"
      data-testid="payment-step"
    >
      <p className="text-eyebrow text-text-accent uppercase">Step 2 of 2 · Payment</p>
      <h2
        id="payment-title"
        ref={focusOnMount}
        tabIndex={-1}
        className="font-display text-heading-2 text-text-primary"
      >
        Pay {amount} to confirm {payment.teamName}
      </h2>
      <dl className="grid max-w-[28rem] grid-cols-[auto_1fr] gap-x-lg gap-y-xs text-body text-text-secondary">
        <dt>Registration fee</dt>
        <dd className="text-right tabular-nums">{feeBreakdown(payment.memberCount)} per member</dd>
        <dt className="text-text-primary">Total</dt>
        <dd
          className="text-right font-medium text-text-primary tabular-nums"
          data-testid="payment-amount"
        >
          {amount}
        </dd>
        <dt>Team reference</dt>
        <dd className="text-right tabular-nums">{payment.reference}</dd>
      </dl>
      <p className="max-w-[40rem] text-body text-text-secondary">
        Your team is saved but not confirmed until you pay. We hold your team name and emails for{" "}
        {event.paymentHoldMinutes} minutes. Pay with UPI, a card or net banking through Razorpay.
      </p>

      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={phase.kind === "problem" ? "border border-border-danger p-md" : "sr-only"}
      >
        {phase.kind === "problem" && <p className="text-label text-text-danger">{phase.message}</p>}
        {phase.kind === "verifying" && <p>Confirming your payment…</p>}
      </div>

      <div className="flex flex-wrap items-center gap-md">
        <Button
          onClick={() => {
            void pay();
          }}
          arrow={!busy}
          disabled={busy || phase.kind === "open"}
          aria-disabled={busy || phase.kind === "open"}
        >
          {phase.kind === "verifying"
            ? "Confirming payment…"
            : phase.kind === "opening"
              ? "Opening Razorpay…"
              : `Pay ${amount}`}
        </Button>
        {phase.kind === "problem" && phase.canCheck && lastResult && (
          <Button
            variant="secondary"
            onClick={() => {
              void confirm(lastResult);
            }}
          >
            Check payment
          </Button>
        )}
      </div>
      <p className="text-body-sm text-text-muted">
        Payments are processed by Razorpay. We never see your card or UPI details.
      </p>
    </section>
  );
}
