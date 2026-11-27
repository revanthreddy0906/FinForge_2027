import "server-only";
import type { CodeOutcome, FactorStatus, LoginDeps, PasswordOutcome } from "@/lib/admin/login-flow";
import {
  authClient,
  authClientFromCookies,
  clearSession,
  dataClientFor,
  saveSession,
} from "./admin-session";
import { allowRequest } from "./rate-limit";

const ISSUER = "FinForge 2027";

function logError(where: string, error: unknown) {
  // Only the error code and status: never emails, passwords or tokens.
  const e = error as { code?: unknown; status?: unknown; name?: unknown } | null;
  console.error("[admin] %s failed", where, { name: e?.name, code: e?.code, status: e?.status });
}

async function signInWithPassword(email: string, password: string): Promise<PasswordOutcome> {
  try {
    const { data, error } = await authClient().auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === "invalid_credentials" || error.status === 400) {
        return { ok: false, reason: "wrong-credentials" };
      }
      logError("password sign-in", error);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, session: data.session };
  } catch (error) {
    logError("password sign-in", error);
    return { ok: false, reason: "unavailable" };
  }
}

async function prepareFactor(session: {
  access_token: string;
  refresh_token: string;
}): Promise<FactorStatus> {
  try {
    const client = authClient();
    const { error: sessionError } = await client.auth.setSession(session);
    if (sessionError) throw sessionError;
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw error;
    const verified = data.totp[0];
    if (verified) return { kind: "verified", factorId: verified.id };

    // Clear half-finished set-ups from earlier attempts, then start a new one.
    for (const factor of data.all) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await client.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const enrolled = await client.auth.mfa.enroll({
      factorType: "totp",
      issuer: ISSUER,
      friendlyName: `Console ${new Date().toISOString().slice(0, 10)}`,
    });
    if (enrolled.error) throw enrolled.error;
    return {
      kind: "needs-enrollment",
      factorId: enrolled.data.id,
      qrCode: enrolled.data.totp.qr_code,
      secret: enrolled.data.totp.secret,
    };
  } catch (error) {
    logError("authenticator set-up", error);
    return { kind: "unavailable" };
  }
}

async function verifyCode(factorId: string, code: string): Promise<CodeOutcome> {
  try {
    const client = await authClientFromCookies();
    if (!client) {
      console.warn("[admin] code check: no usable session in the cookies");
      return { ok: false, reason: "session-lost" };
    }
    const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) {
      logError("code check", error);
      if (
        error.code === "mfa_verification_failed" ||
        error.status === 422 ||
        error.status === 400
      ) {
        return { ok: false, reason: "wrong-code" };
      }
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return { ok: false, reason: "session-lost" };
      }
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, session: data };
  } catch (error) {
    logError("code check", error);
    return { ok: false, reason: "unavailable" };
  }
}

async function isOrganizer(accessToken: string): Promise<boolean> {
  const { data, error } = await dataClientFor(accessToken).rpc("current_user_is_admin");
  if (error) {
    logError("organizer check", error);
    return false;
  }
  return data;
}

export const loginDeps: LoginDeps = {
  allowRequest: (ip) => allowRequest("admin-login", ip),
  signInWithPassword,
  prepareFactor,
  verifyCode,
  isOrganizer,
  saveSession,
  clearSession,
};

/** Revokes this session's refresh token (best effort) and clears the cookies. */
export async function signOut(): Promise<void> {
  try {
    const client = await authClientFromCookies();
    await client?.auth.signOut({ scope: "local" });
  } catch (error) {
    logError("sign-out", error);
  }
  await clearSession();
}
