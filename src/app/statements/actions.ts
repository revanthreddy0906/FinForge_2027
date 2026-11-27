"use server";

import { selectionFormData } from "@/lib/statements/schema";
import { submitSelection, type SubmitResult } from "@/lib/statements/submit";
import { clientIp } from "@/lib/server/client-ip";
import { allowRequest } from "@/lib/server/rate-limit";
import { saveChoice } from "@/lib/server/statements";

/**
 * Submits per minute from one IP. On event day every team may share the venue Wi-Fi's single
 * public IP, so this only stops floods. There is deliberately no per-reference limit: references
 * are guessable, so anyone could use one to lock a rival team out while slots fill up. Guessing
 * a team code is not practical anyway (32^8, about 10^12 codes, at 300 tries a minute).
 */
const NETWORK_LIMIT_PER_MINUTE = 300;

/** Server action behind the problem statement selection form. */
export async function submitSelectionAction(
  _previous: SubmitResult,
  formData: FormData,
): Promise<SubmitResult> {
  const ip = await clientIp();
  return submitSelection(selectionFormData(formData), {
    allowNetwork: () => allowRequest("statements-ip", ip, NETWORK_LIMIT_PER_MINUTE),
    saveChoice,
  });
}
