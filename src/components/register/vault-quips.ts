/**
 * Lines the "coming soon" vault dial shows when someone tries to open it.
 * Playful, never a real technique, never a date. They cycle in order so the
 * server and browser render the same text and the same line never shows twice in a row.
 */
export const vaultQuips = [
  "Nice try. Even you can't brute-force this one.",
  "Our fraud model just flagged that tap as suspicious.",
  "Wrong combination. Hint: it isn't 1234.",
  "No backdoors here. Just a front door that opens soon.",
  "Social engineering doesn't work on a dial. We checked.",
  "Patience is a security feature.",
  "Access denied. Your team can start planning anyway.",
] as const;

/** Shown in the live region before the first tap. */
export const vaultPrompt = "Go on, try the dial.";

/** Index of the quip after `current`; -1 means nothing has been shown yet. */
export function nextQuipIndex(current: number, count: number = vaultQuips.length): number {
  if (count <= 0) return -1;
  return (current + 1) % count;
}
