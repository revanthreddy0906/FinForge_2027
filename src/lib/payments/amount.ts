import { event } from "@/config/event";
import { formatINR } from "@/lib/format-inr";

/** Fee per member in paise, the unit Razorpay works in. */
export const feePerMemberPaise = Math.round(event.fee.perMemberRupees * 100);

/** Fee for a team of `members` people, in paise. */
export function teamFeePaise(members: number): number {
  if (!Number.isInteger(members) || members < event.team.minSize || members > event.team.maxSize) {
    throw new RangeError(
      `team size must be ${String(event.team.minSize)} to ${String(event.team.maxSize)}`,
    );
  }
  return members * feePerMemberPaise;
}

/** "₹2,097" for 209700 paise. Fees are whole rupees. */
export function formatPaise(paise: number): string {
  return formatINR(paise / 100);
}

/** "3 × ₹699" for the fee breakdown. */
export function feeBreakdown(members: number): string {
  return `${String(members)} × ${formatINR(event.fee.perMemberRupees)}`;
}
