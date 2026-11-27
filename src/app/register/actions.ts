"use server";

import { event } from "@/config/event";
import { formDataToInput, turnstileTokenFrom } from "@/lib/registration/form-data";
import { registerTeam, type RegisterResult } from "@/lib/registration/register";
import { headers } from "next/headers";
import { clientIp } from "@/lib/server/client-ip";
import { LOAD_TEST_CLIENT_HEADER, LOAD_TEST_HEADER, rateLimitKey } from "@/lib/server/load-test";
import { startPayment } from "@/lib/payments/flow";
import { startDeps } from "@/lib/server/payments";
import { allowRequest } from "@/lib/server/rate-limit";
import { saveTeam } from "@/lib/server/save-team";
import { verifyTurnstile } from "@/lib/server/turnstile";

/**
 * Registrations allowed per minute per IP. Teams on one college Wi-Fi share an IP, so this is
 * higher than the 5 a minute elsewhere; Turnstile still stops bots on every submit.
 */
const REGISTER_LIMIT_PER_MINUTE = 20;

/** Server action behind the registration form. */
export async function registerAction(
  _previous: RegisterResult,
  formData: FormData,
): Promise<RegisterResult> {
  const ip = await clientIp();
  const h = await headers();
  const limitKey = rateLimitKey(ip, {
    vercelEnv: process.env.VERCEL_ENV,
    secret: process.env.FINFORGE_LOAD_TEST_SECRET,
    header: h.get(LOAD_TEST_HEADER),
    client: h.get(LOAD_TEST_CLIENT_HEADER),
  });
  return registerTeam(formDataToInput(formData), turnstileTokenFrom(formData), ip, {
    registrationState: () => event.registration,
    allowRequest: () => allowRequest("register", limitKey, REGISTER_LIMIT_PER_MINUTE),
    verifyHuman: verifyTurnstile,
    saveTeam,
    startPayment: (teamId) => startPayment(teamId, startDeps),
  });
}
