"use server";

import { selectionFormData } from "@/lib/statements/schema";
import { submitSelection, type SubmitResult } from "@/lib/statements/submit";
import { clientIp } from "@/lib/server/client-ip";
import { allowRequest } from "@/lib/server/rate-limit";
import { saveChoice } from "@/lib/server/statements";

/**
 * Submits per minute from one IP. On event day every team may share the venue Wi-Fi's single
 * public IP, so this only stops floods; the per-reference limit below stops code guessing.
 */
const NETWORK_LIMIT_PER_MINUTE = 300;
/** Attempts per minute for one team reference, right or wrong. A real team needs one or two. */
const REFERENCE_LIMIT_PER_MINUTE = 5;

/** Server action behind the problem statement selection form. */
export async function submitSelectionAction(
  _previous: SubmitResult,
  formData: FormData,
): Promise<SubmitResult> {
  const ip = await clientIp();
  return submitSelection(selectionFormData(formData), {
    allowNetwork: () => allowRequest("statements-ip", ip, NETWORK_LIMIT_PER_MINUTE),
    allowReference: (reference) =>
      allowRequest("statements-ref", reference, REFERENCE_LIMIT_PER_MINUTE),
    saveChoice,
  });
}
