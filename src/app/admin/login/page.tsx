import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Organizer sign-in · FinForge 2027",
};

export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex max-w-[28rem] flex-col gap-xl">
      <div className="flex flex-col gap-sm">
        <h1 className="font-display text-heading-1 text-text-primary">Organizer sign-in</h1>
        <p className="text-body text-text-secondary">
          For the FinForge team only. You&apos;ll need your password and your authenticator app.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
