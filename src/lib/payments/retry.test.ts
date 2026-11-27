import { describe, expect, it, vi } from "vitest";
import { retryOnThrottle, THROTTLE_BACKOFF_MS } from "./retry";

class Throttled extends Error {}
const isThrottle = (e: unknown) => e instanceof Throttled;

describe("retryOnThrottle", () => {
  it("returns the first success without waiting", async () => {
    const wait = vi.fn(() => Promise.resolve());
    await expect(
      retryOnThrottle(() => Promise.resolve("order_1"), { isThrottle, wait }),
    ).resolves.toBe("order_1");
    expect(wait).not.toHaveBeenCalled();
  });

  it("retries a throttled call with growing, jittered delays", async () => {
    const wait = vi.fn(() => Promise.resolve());
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Throttled())
      .mockRejectedValueOnce(new Throttled())
      .mockResolvedValueOnce("order_1");
    await expect(retryOnThrottle(fn, { isThrottle, wait, random: () => 0.5 })).resolves.toBe(
      "order_1",
    );
    expect(fn).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[450], [1050]]);
  });

  it("gives up after the last delay and rethrows the throttle", async () => {
    const wait = vi.fn(() => Promise.resolve());
    const fn = vi.fn(() => Promise.reject(new Throttled()));
    await expect(retryOnThrottle(fn, { isThrottle, wait })).rejects.toBeInstanceOf(Throttled);
    expect(fn).toHaveBeenCalledTimes(THROTTLE_BACKOFF_MS.length + 1);
  });

  it("never retries other errors", async () => {
    const wait = vi.fn(() => Promise.resolve());
    const fn = vi.fn(() => Promise.reject(new Error("bad request")));
    await expect(retryOnThrottle(fn, { isThrottle, wait })).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
