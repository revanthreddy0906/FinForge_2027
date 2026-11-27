/** Delays between attempts when Razorpay answers 429 (before jitter), in milliseconds. */
export const THROTTLE_BACKOFF_MS = [300, 700, 1500] as const;

interface RetryOptions {
  /** true for an error worth retrying (Razorpay's 429 throttle). */
  isThrottle: (error: unknown) => boolean;
  wait?: (ms: number) => Promise<void>;
  random?: () => number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Runs `fn`, retrying only when Razorpay throttles it (HTTP 429), with growing, jittered delays.
 * A throttled request is rejected before anything is created, so retrying can't make a second
 * order. The k6 spike test (75 teams in one second) showed Razorpay accepting about 50 order
 * creations at once and throttling the rest; spreading the retries lets them all through.
 */
export async function retryOnThrottle<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const wait = options.wait ?? sleep;
  const random = options.random ?? Math.random;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const delay = THROTTLE_BACKOFF_MS.at(attempt);
      if (delay === undefined || !options.isThrottle(error)) throw error;
      await wait(delay + Math.floor(random() * delay));
    }
  }
}
