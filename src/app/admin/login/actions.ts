"use server";

import { redirect } from "next/navigation";
import { codeStep, passwordStep } from "@/lib/admin/login-flow";
import type { LoginState } from "@/lib/admin/login-state";
import { clientIp } from "@/lib/server/client-ip";
import { loginDeps, signOut } from "@/lib/server/admin-login";

/** One action for both steps, so the form keeps a single state (and the QR code) between them. */
export async function loginAction(previous: LoginState, formData: FormData): Promise<LoginState> {
  const ip = await clientIp();
  if (formData.get("step") === "code") {
    const next = await codeStep(
      { factorId: formData.get("factorId"), code: formData.get("code") },
      previous,
      ip,
      loginDeps,
    );
    if (next === "done") redirect("/admin");
    return next;
  }
  return passwordStep(
    { email: formData.get("email"), password: formData.get("password") },
    ip,
    loginDeps,
  );
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/admin/login");
}
