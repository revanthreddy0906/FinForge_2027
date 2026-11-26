"use client";

import { useActionState, useCallback } from "react";
import { loginAction } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  initialLoginState,
  keepQrCode,
  withoutQrCode,
  type LoginState,
} from "@/lib/admin/login-state";

/** Sends the previous state without the large QR image, and restores it afterwards. */
async function submit(previous: LoginState, formData: FormData): Promise<LoginState> {
  return keepQrCode(previous, await loginAction(withoutQrCode(previous), formData));
}

/** Groups the secret in fours so it's easier to type into an authenticator app. */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

function ErrorBanner({ message }: { message?: string }) {
  // Focus the message when it appears, so screen reader and keyboard users hear it first.
  const focusOnMount = useCallback((el: HTMLParagraphElement | null) => el?.focus(), []);
  if (!message) return null;
  return (
    <p
      ref={focusOnMount}
      tabIndex={-1}
      role="alert"
      data-testid="login-error"
      className="flex gap-xs border border-border-danger px-md py-sm text-body-sm text-text-danger"
    >
      <span aria-hidden="true">!</span>
      <span>{message}</span>
    </p>
  );
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(submit, initialLoginState);
  const focusHeading = useCallback((el: HTMLHeadingElement | null) => el?.focus(), []);

  if (state.step === "password") {
    return (
      <form action={formAction} noValidate className="flex flex-col gap-lg">
        <input type="hidden" name="step" value="password" />
        <ErrorBanner message={state.error} />
        <Field
          id="admin-email"
          name="email"
          type="email"
          label="Email"
          autoComplete="username"
          inputMode="email"
          maxLength={254}
          required
          error={state.fieldErrors?.email}
        />
        <Field
          id="admin-password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          maxLength={256}
          required
          error={state.fieldErrors?.password}
        />
        <Button type="submit" arrow disabled={pending} className="self-start">
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </form>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-lg">
      <input type="hidden" name="step" value="code" />
      <input type="hidden" name="factorId" value={state.factorId} />
      {state.step === "enroll" ? (
        <div className="flex flex-col gap-md">
          <h2
            ref={focusHeading}
            tabIndex={-1}
            className="font-display text-heading-3 text-text-primary outline-none"
          >
            Set up your authenticator app
          </h2>
          <p className="text-body text-text-secondary">
            Scan this code with Google Authenticator, Microsoft Authenticator or 1Password. You only
            do this once.
          </p>
          <div className="self-start bg-bg-paper p-sm">
            {/* A data: URI from Supabase, so next/image can't optimise it and doesn't need to. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.qrCode}
              width={176}
              height={176}
              alt="QR code to add FinForge 2027 to your authenticator app"
            />
          </div>
          <p className="text-body-sm text-text-secondary">
            Can&apos;t scan it? Enter this key instead:{" "}
            <code
              data-testid="totp-secret"
              className="tracking-wider font-body break-all text-text-primary"
            >
              {groupSecret(state.secret)}
            </code>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          <h2
            ref={focusHeading}
            tabIndex={-1}
            className="font-display text-heading-3 text-text-primary outline-none"
          >
            Enter your authenticator code
          </h2>
          <p className="text-body text-text-secondary">
            Open your authenticator app and enter the 6-digit code for FinForge 2027.
          </p>
        </div>
      )}
      <ErrorBanner message={state.error} />
      <Field
        id="admin-code"
        name="code"
        label="6-digit code"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9 ]*"
        maxLength={7}
        required
      />
      <Button type="submit" arrow disabled={pending} className="self-start">
        {pending ? "Checking…" : "Open the console"}
      </Button>
    </form>
  );
}
