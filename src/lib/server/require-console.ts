import "server-only";
import { redirect } from "next/navigation";
import { readAdminSession } from "./admin-session";

/** The verified organizer's access token, or a redirect to sign-in or session refresh. */
export async function requireConsole(
  from:
    | "/admin"
    | "/admin/export"
    | "/admin/statements"
    | "/admin/statements/codes"
    | "/admin/statements/export",
): Promise<{
  email: string;
  accessToken: string;
}> {
  const session = await readAdminSession();
  switch (session.state) {
    case "verified":
      return { email: session.email, accessToken: session.accessToken };
    case "expired":
      redirect(`/admin/session?next=${encodeURIComponent(from)}`);
    case "partial":
    case "signed-out":
      redirect("/admin/login");
  }
}
