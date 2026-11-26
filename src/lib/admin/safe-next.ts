/** Only same-site console paths are allowed as a post-refresh destination. */
export function safeConsolePath(next: string | null): string {
  if (next === "/admin" || next === "/admin/export") return next;
  return "/admin";
}
