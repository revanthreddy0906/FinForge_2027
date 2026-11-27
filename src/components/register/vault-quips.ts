/**
 * Copy and rules for the "coming soon" vault game on /register.
 * Quips are playful, never a real technique, never a date. They cycle in order so the
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

/** Shown before the first try on this device. */
export const vaultPrompt = "Go on, try the dial.";

/** Every this many tries the vault cracks open for a moment. */
export const CRACK_EVERY = 10;

/** localStorage key for the try counter. Only a number is stored, nothing personal. */
export const ATTEMPTS_KEY = "finforge-vault-attempts";

/** Largest count we keep, so a tampered value can't break the layout. */
const MAX_ATTEMPTS = 99_999;

/** Index of the quip after `current`; -1 means nothing has been shown yet. */
export function nextQuipIndex(current: number, count: number = vaultQuips.length): number {
  if (count <= 0) return -1;
  return (current + 1) % count;
}

/** Reads a stored try count, treating anything odd as zero. */
export function parseAttempts(raw: string | null): number {
  if (raw === null || !/^\d{1,5}$/.test(raw)) return 0;
  return Math.min(Number(raw), MAX_ATTEMPTS);
}

/** The count after one more try, capped. */
export function bumpAttempts(n: number): number {
  return Math.min(n + 1, MAX_ATTEMPTS);
}

/** True when this try (1-based count after the tap) cracks the vault. */
export function isCrackAttempt(n: number): boolean {
  return n > 0 && n % CRACK_EVERY === 0;
}

export function welcomeBack(n: number): string {
  return `Welcome back. That's ${String(n)} tries so far. Still locked.`;
}

export function crackMessage(dateLabel: string): string {
  return `That's the hacker spirit. Save it for ${dateLabel}.`;
}
