import { limits } from "./schema";

/** Form field names, shared by the form and the server so they can't drift. */
export const fieldName = {
  teamName: "teamName",
  institution: "institution",
  leaderPhone: "leaderPhone",
  consent: "consent",
  idempotencyKey: "idempotencyKey",
  turnstileToken: "cf-turnstile-response",
  memberName: (i: number) => `members.${String(i)}.fullName`,
  memberEmail: (i: number) => `members.${String(i)}.email`,
} as const;

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * Turns submitted FormData into the plain object the Zod schema expects. Reads at most the
 * maximum number of members, and stops at the first member slot that wasn't submitted.
 */
export function formDataToInput(fd: FormData) {
  const members: { fullName: string; email: string }[] = [];
  for (let i = 0; i < limits.members.max; i++) {
    if (!fd.has(fieldName.memberName(i)) && !fd.has(fieldName.memberEmail(i))) break;
    members.push({
      fullName: str(fd, fieldName.memberName(i)),
      email: str(fd, fieldName.memberEmail(i)),
    });
  }
  return {
    teamName: str(fd, fieldName.teamName),
    institution: str(fd, fieldName.institution),
    leaderPhone: str(fd, fieldName.leaderPhone),
    members,
    consent: fd.get(fieldName.consent) === "on",
    idempotencyKey: str(fd, fieldName.idempotencyKey),
  };
}

export function turnstileTokenFrom(fd: FormData): string {
  return str(fd, fieldName.turnstileToken).slice(0, 2048);
}
