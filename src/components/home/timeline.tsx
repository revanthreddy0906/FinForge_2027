import { cacheLife } from "next/cache";
import { event, type TimelineEntry } from "@/config/event";
import { TimelineItem, type TimelineStatus } from "../ui/timeline-item";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

/** Status from real dates only. With no dates yet, the hackathon itself is the highlighted step. */
function statusOf(entry: TimelineEntry, index: number, today: string): TimelineStatus {
  if (entry.date)
    return entry.date < today ? "past" : entry.date === today ? "current" : "upcoming";
  return index === 2 ? "current" : "upcoming";
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
              Exact dates are announced soon. Follow{" "}
              <a
                href={event.instagram.url}
                className="text-text-accent underline decoration-border-frame underline-offset-4"
                rel="noopener noreferrer"
                target="_blank"
              >
                @{event.instagram.handle}
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
