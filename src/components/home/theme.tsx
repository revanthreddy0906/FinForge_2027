import { event } from "@/config/event";
import { Card } from "../ui/card";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

export function Theme() {
  return (
    <Section id="theme" labelledBy="theme-title" tone="surface">
      <SectionHeader
        id="theme-title"
        index="02"
        eyebrow="Theme"
        title={event.theme}
        description="Every track asks one question: how do we keep money and identities safe? Problem statements are published before the event."
      />
      <div className="grid gap-lg md:grid-cols-3">
        {event.tracks
          ? event.tracks.map((t, i) => (
              <Card
                key={t.title}
                eyebrow={`Track ${String(i + 1)}`}
                title={t.title}
                highlight={i === 0}
              >
                {t.description}
              </Card>
            ))
          : [1, 2, 3].map((n) => (
              <Card
                key={n}
                eyebrow={`Track ${String(n)}`}
                title="To be announced"
                highlight={n === 1}
              >
                {/* TODO: track name and problem statement. */}
                Track details are announced soon.
              </Card>
            ))}
      </div>
    </Section>
  );
}
