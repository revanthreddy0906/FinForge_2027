import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Organizer console · FinForge 2027",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b border-border-subtle px-gutter py-md">
        <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-md">
          <Link href="/" aria-label="FinForge 2027 home" className="rounded-xs">
            <Logo />
          </Link>
          <p className="text-eyebrow text-text-accent uppercase">Organizer console</p>
        </div>
      </header>
      <main id="main" className="flex-1 px-gutter py-2xl md:py-3xl">
        {children}
      </main>
    </>
  );
}
