"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-lg px-gutter py-section md:items-center md:text-center">
      <h1 className="font-display text-heading-1 text-text-primary">This page didn&apos;t load</h1>
      <p className="max-w-[32rem] text-body-lg text-text-secondary">
        Something failed while loading the page. Try again, or come back in a few minutes.
      </p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
