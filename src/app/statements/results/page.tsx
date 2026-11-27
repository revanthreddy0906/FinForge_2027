import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Footer } from "@/components/home/footer";
import { SiteNav } from "@/components/site-nav";
import { problemStatements } from "@/config/problem-statements";
import { publishedResults, selectionStatus, type PublishedResult } from "@/lib/server/statements";

export const metadata: Metadata = {
  title: "Problem statement results · FinForge 2027",
  description: "Which problem statement each FinForge 2027 team will build for, by team reference.",
  alternates: { canonical: "/statements/results" },
};

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-md border border-border-frame p-lg md:p-2xl">
      <h2 className="font-display text-heading-2 text-text-primary">{title}</h2>
      <p className="max-w-[40rem] text-body-lg text-text-secondary">{body}</p>
    </div>
  );
}

async function load(): Promise<PublishedResult[] | null> {
  try {
    const status = await selectionStatus();
    if (!status.resultsPublished) return [];
    return await publishedResults();
  } catch {
    return null;
  }
}

async function Results() {
  // Read at request time only: never during the build, which has no database.
  await connection();
  const results = await load();
  if (!results) {
    return <Notice title="Results couldn't load" body="Refresh the page in a moment." />;
  }
  if (results.length === 0) {
    return (
      <Notice
        title="Results aren't out yet"
        body="The organizers will publish them here once selection closes. Refresh this page to check again."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2xl" data-testid="results">
      {problemStatements.map((s) => {
        const teams = results.filter((r) => r.statementId === s.id);
        return (
          <section
            key={s.id}
            aria-labelledby={`statement-${String(s.id)}`}
            className="flex flex-col gap-md"
          >
            <h2
              id={`statement-${String(s.id)}`}
              className="font-display text-heading-3 text-text-primary"
            >
              {s.title}
            </h2>
            <p className="text-body-sm text-text-secondary">
              {teams.length} {teams.length === 1 ? "team" : "teams"}
            </p>
            {teams.length > 0 && (
              <ul className="grid grid-cols-3 gap-xs sm:grid-cols-4 md:grid-cols-6">
                {teams.map((t) => (
                  <li
                    key={t.reference}
                    className="border border-border-subtle px-sm py-xs text-center text-label text-text-primary tabular-nums"
                  >
                    {t.reference}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-xs focus:left-xs focus:z-50 focus:rounded-xs focus:bg-bg-accent focus:px-md focus:py-xs focus:text-label focus:text-text-on-accent"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1 px-gutter py-2xl md:py-4xl">
        <div className="mx-auto flex max-w-[48rem] flex-col gap-2xl">
          <header className="flex flex-col gap-md">
            <h1 className="font-display text-heading-1 text-text-primary">
              Problem statement results
            </h1>
            <p className="text-body-lg text-text-secondary">
              Find your team reference to see which statement your team builds for.
            </p>
          </header>
          <Suspense fallback={<p className="text-body text-text-secondary">Loading results…</p>}>
            <Results />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
