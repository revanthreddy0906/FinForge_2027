import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Footer } from "@/components/home/footer";
import { SiteNav } from "@/components/site-nav";
import { SelectionForm } from "@/components/statements/selection-form";
import { Badge } from "@/components/ui/badge";
import { problemStatements } from "@/config/problem-statements";
import { selectionStatus, type SelectionStatus } from "@/lib/server/statements";

export const metadata: Metadata = {
  title: "Choose your problem statement · FinForge 2027",
  description:
    "On event day, each FinForge 2027 team ranks the four problem statements once. Statements go to teams in the order their choices arrive.",
  alternates: { canonical: "/statements" },
};

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-md border border-border-frame p-lg md:p-2xl">
      <h2 className="font-display text-heading-2 text-text-primary">{title}</h2>
      <p className="max-w-[40rem] text-body-lg text-text-secondary">{body}</p>
    </div>
  );
}

async function loadStatus(): Promise<SelectionStatus | null> {
  try {
    return await selectionStatus();
  } catch {
    return null;
  }
}

async function Selection() {
  // Read at request time only: never during the build, which has no database.
  await connection();
  const status = await loadStatus();
  if (!status) {
    return (
      <Notice
        title="This page couldn't load"
        body="We couldn't check whether selection is open. Refresh the page in a moment."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2xl">
      <div>
        <Badge
          tone={
            status.state === "open" ? "accent" : status.state === "closed" ? "danger" : "neutral"
          }
        >
          {status.state === "open"
            ? "Selection open"
            : status.state === "closed"
              ? "Selection closed"
              : "Opens soon"}
        </Badge>
      </div>

      {status.state === "not_open" && (
        <Notice
          title="Selection hasn't opened yet"
          body="The organizers will announce when it opens. Keep this page handy, then refresh it. Have your team reference ready."
        />
      )}

      {status.state === "closed" && (
        <Notice
          title="Selection has closed"
          body={
            status.resultsPublished
              ? "Results are out. See which statement your team has on the results page."
              : "Thanks, every entry is in. The organizers will publish each team's statement on the results page."
          }
        />
      )}

      {status.state === "open" && (
        <>
          <section aria-labelledby="statements-title" className="flex flex-col gap-lg">
            <h2 id="statements-title" className="font-display text-heading-3 text-text-primary">
              The four problem statements
            </h2>
            <ol className="flex flex-col gap-md">
              {problemStatements.map((s) => (
                <li key={s.id} className="flex flex-col gap-xs border-l border-border-frame pl-md">
                  <h3 className="text-label text-text-accent">{s.title}</h3>
                  <p className="text-body text-text-secondary">{s.summary}</p>
                </li>
              ))}
            </ol>
          </section>
          <SelectionForm statements={problemStatements.map(({ id, title }) => ({ id, title }))} />
        </>
      )}

      {status.state !== "not_open" && (
        <p>
          <a
            href="/statements/results"
            className="text-label text-text-accent underline underline-offset-4"
          >
            Go to the results page
          </a>
        </p>
      )}
    </div>
  );
}

export default function StatementsPage() {
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
              Choose your problem statement
            </h1>
            <p className="text-body-lg text-text-secondary">
              One person per team ranks all four statements, once. Statements go to teams in the
              order their choices arrive: your 1st choice if it still has room, otherwise your 2nd,
              and so on.
            </p>
          </header>
          <Suspense fallback={<p className="text-body text-text-secondary">Checking selection…</p>}>
            <Selection />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
