"use server";

import { event } from "@/config/event";
import { formDataToInput, turnstileTokenFrom } from "@/lib/registration/form-data";
import { registerTeam, type RegisterResult } from "@/lib/registration/register";
import { clientIp } from "@/lib/server/client-ip";
import { sendConfirmationEmail } from "@/lib/server/confirmation-email";
import { allowRequest } from "@/lib/server/rate-limit";
import { saveTeam } from "@/lib/server/save-team";
import { verifyTurnstile } from "@/lib/server/turnstile";

/** Server action behind the registration form. */
export async function registerAction(
  _previous: RegisterResult,
  formData: FormData,
): Promise<RegisterResult> {
  const ip = await clientIp();
  return registerTeam(formDataToInput(formData), turnstileTokenFrom(formData), ip, {
    registrationState: () => event.registration,
    allowRequest: (requestIp) => allowRequest("register", requestIp),
    verifyHuman: verifyTurnstile,
    saveTeam,
    sendConfirmation: sendConfirmationEmail,
  });
}
