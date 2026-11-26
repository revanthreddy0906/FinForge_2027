import { codeSchema, loginSchema } from "./login-schema";
import { loginCopy, type LoginState } from "./login-state";

export type PasswordOutcome =
  | { ok: true; session: { access_token: string; refresh_token: string } }
  | { ok: false; reason: "wrong-credentials" | "unavailable" };

export type FactorStatus =
  | { kind: "verified"; factorId: string }
  | { kind: "needs-enrollment"; factorId: string; qrCode: string; secret: string }
  | { kind: "unavailable" };

export type CodeOutcome =
  | { ok: true; session: { access_token: string; refresh_token: string } }
  | { ok: false; reason: "wrong-code" | "session-lost" | "unavailable" };

/** Everything the sign-in steps talk to, injected so the flow is testable without a network. */
export interface LoginDeps {
  allowRequest: (ip: string) => Promise<boolean>;
  signInWithPassword: (email: string, password: string) => Promise<PasswordOutcome>;
  /** Uses the session just created (or the one in the cookies) to find or start a TOTP factor. */
  prepareFactor: (session: {
    access_token: string;
    refresh_token: string;
  }) => Promise<FactorStatus>;
  verifyCode: (factorId: string, code: string) => Promise<CodeOutcome>;
  isOrganizer: (accessToken: string) => Promise<boolean>;
  saveSession: (session: { access_token: string; refresh_token: string }) => Promise<void>;
  clearSession: () => Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSafeEnrollment(s: { factorId: unknown; qrCode: unknown; secret: unknown }): boolean {
  return (
    typeof s.factorId === "string" &&
    UUID.test(s.factorId) &&
    typeof s.qrCode === "string" &&
    s.qrCode.startsWith("data:image/svg+xml") &&
    s.qrCode.length < 200_000 &&
    typeof s.secret === "string" &&
    /^[A-Z2-7]{16,64}$/.test(s.secret)
  );
}

async function rateLimited(deps: LoginDeps, ip: string): Promise<boolean> {
  try {
    return !(await deps.allowRequest(ip));
  } catch {
    // Fail closed: no rate limiter, no sign-in.
    return true;
  }
}

/** Step 1: email and password. Moves to the authenticator step on success. */
export async function passwordStep(
  raw: { email: unknown; password: unknown },
  ip: string,
  deps: LoginDeps,
): Promise<LoginState> {
  if (await rateLimited(deps, ip)) return { step: "password", error: loginCopy.rateLimited };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: { email?: string; password?: string } = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "email" && !fieldErrors.email) fieldErrors.email = issue.message;
      if (key === "password" && !fieldErrors.password) fieldErrors.password = issue.message;
    }
    return { step: "password", error: "Check the highlighted fields.", fieldErrors };
  }

  const result = await deps.signInWithPassword(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return {
      step: "password",
      error:
        result.reason === "wrong-credentials" ? loginCopy.wrongCredentials : loginCopy.unavailable,
    };
  }
  await deps.saveSession(result.session);

  const factor = await deps.prepareFactor(result.session);
  switch (factor.kind) {
    case "verified":
      return { step: "verify", factorId: factor.factorId };
    case "needs-enrollment":
      return {
        step: "enroll",
        factorId: factor.factorId,
        qrCode: factor.qrCode,
        secret: factor.secret,
      };
    case "unavailable":
      await deps.clearSession();
      return { step: "password", error: loginCopy.unavailable };
  }
}

/** Step 2: the 6-digit authenticator code. Returns "done" when the console may open. */
export async function codeStep(
  raw: { factorId: unknown; code: unknown },
  previous: LoginState,
  ip: string,
  deps: LoginDeps,
): Promise<LoginState | "done"> {
  // Keep showing the same step (and QR code, while enrolling) when the code is wrong. The
  // previous state round-trips through the browser, so only well-formed values are kept.
  const stay = (error: string): LoginState => {
    if (previous.step === "enroll" && isSafeEnrollment(previous)) {
      return {
        step: "enroll",
        factorId: previous.factorId,
        qrCode: previous.qrCode,
        secret: previous.secret,
        error,
      };
    }
    if (previous.step === "verify" && UUID.test(previous.factorId)) {
      return { step: "verify", factorId: previous.factorId, error };
    }
    return { step: "password", error: loginCopy.sessionLost };
  };

  if (await rateLimited(deps, ip)) return stay(loginCopy.rateLimited);

  const parsed = codeSchema.safeParse(raw);
  if (!parsed.success) {
    if (previous.step === "password") return { step: "password", error: loginCopy.sessionLost };
    return stay(parsed.error.issues[0]?.message ?? loginCopy.wrongCode);
  }

  const result = await deps.verifyCode(parsed.data.factorId, parsed.data.code);
  if (!result.ok) {
    if (result.reason === "session-lost") {
      await deps.clearSession();
      return { step: "password", error: loginCopy.sessionLost };
    }
    return stay(result.reason === "wrong-code" ? loginCopy.wrongCode : loginCopy.unavailable);
  }

  if (!(await deps.isOrganizer(result.session.access_token))) {
    await deps.clearSession();
    return { step: "password", error: loginCopy.notOrganizer };
  }
  await deps.saveSession(result.session);
  return "done";
}
