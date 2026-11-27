/**
 * Runs `task` once the page has finished loading and the main thread is idle, so optional
 * scripts (error monitoring, analytics) never delay the first paint or hydration on slow phones.
 */
export function afterLoadWhenIdle(task: () => void, timeoutMs = 5000): void {
  const whenIdle = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(task, { timeout: timeoutMs });
    } else {
      setTimeout(task, 2000);
    }
  };
  if (document.readyState === "complete") {
    whenIdle();
  } else {
    window.addEventListener("load", whenIdle, { once: true });
  }
}
