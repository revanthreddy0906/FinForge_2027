const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/**
 * Formats a rupee amount in Indian digit grouping, e.g. 300000 -> "₹3,00,000".
 * Fractions are rounded away because prize and fee amounts are whole rupees.
 */
export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`formatINR expects a finite number, got ${String(amount)}`);
  }
  return inrFormatter.format(amount);
}
