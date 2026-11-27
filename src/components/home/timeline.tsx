import { cacheLife } from "next/cache";
import { event, type TimelineEntry } from "@/config/event";
import { TimelineItem, type TimelineStatus } from "../ui/timeline-item";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

/**
 * Status from real dates only. The next dated step still to come is highlighted, so the
 * hackathon stays the highlighted step until its day; with no dates at all, the hackathon is.
 */
function statusOf(entry: TimelineEntry, index: number, today: string): TimelineStatus {
  if (entry.date && entry.date < today) return "past";
  const anyDated = event.timeline.some((e) => e.date !== null);
  const next = event.timeline.findIndex((e) => e.date !== null && e.date >= today);
  return index === (anyDated ? next : 2) ? "current" : "upcoming";
}

/** Today's date (UTC), re-evaluated hourly so past steps flip without a redeploy. */
// eslint-disable-next-line @typescript-eslint/require-await -- "use cache" functions must be async
async function today(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return new Date().toISOString().slice(0, 10);
}

export async function Timeline() {
  const date = await today();
  return (
    <Section id="timeline" labelledBy="timeline-title">
      <div className="grid gap-2xl md:grid-cols-[1fr_1.2fr] md:gap-3xl">
        <SectionHeader
          id="timeline-title"
          index="03"
          eyebrow="Timeline"
          title="From sign-up to demo day"
          description={
            <>
              The hackathon runs {event.dateLabel}. Registration dates are announced soon. Follow{" "}
              <a
                href={event.instagram.url}
                className="text-text-accent underline decoration-border-frame underline-offset-4"
                rel="noopener noreferrer"
                target="_blank"
              >
                @{event.instagram.handle}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              for updates.
            </>
          }
        />
        <ol className="relative" data-reveal>
          <span
            aria-hidden="true"
            className="timeline-rail absolute top-2 bottom-xl left-[calc(0.5rem-0.5px)] w-px origin-top bg-border-default"
          />
          {event.timeline.map((entry, i) => (
            <TimelineItem
              key={entry.title}
              title={entry.title}
              description={entry.description}
              dateLabel={entry.dateLabel}
              dateTime={entry.date}
              status={statusOf(entry, i, date)}
            />
          ))}
        </ol>
      </div>
    </Section>
  );
}
