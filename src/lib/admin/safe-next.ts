const consolePaths = new Set([
  "/admin",
  "/admin/export",
  "/admin/statements",
  "/admin/statements/export",
]);

/** Only same-site console paths are allowed as a post-refresh destination. */
export function safeConsolePath(next: string | null): string {
  return next !== null && consolePaths.has(next) ? next : "/admin";
}
