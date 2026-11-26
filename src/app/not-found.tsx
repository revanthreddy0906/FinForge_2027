import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-lg px-gutter py-section md:items-center md:text-center">
      <p className="text-eyebrow text-text-accent uppercase">Error 404</p>
      <h1 className="font-display text-heading-1 text-text-primary">
        This page doesn&apos;t exist
      </h1>
      <p className="max-w-[32rem] text-body-lg text-text-secondary">
        The link may be old or mistyped. Everything about FinForge 2027 is on the home page.
      </p>
      <ButtonLink href="/">Go to the home page</ButtonLink>
    </main>
  );
}
