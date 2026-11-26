import { event } from "@/config/event";
import { formatINR } from "@/lib/format-inr";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

export function About() {
  const stats = [
    [formatINR(event.prizePool), "Prize pool"],
    [`${String(event.team.minSize)}–${String(event.team.maxSize)}`, "Members per team"],
    [event.shortDateLabel, "Hyderabad"],
  ] as const;

  return (
    <Section id="about" labelledBy="about-title">
      <div className="grid gap-2xl md:grid-cols-[1.2fr_1fr] md:gap-3xl">
        <SectionHeader
          id="about-title"
          index="01"
          eyebrow="About"
          title="Forge the defence against fraud"
          description="Digital payments move fast, and so does fraud. FinForge 2027 brings student teams together to build working tools that detect fraud, stop scams and protect people's money."
        />
        <div className="flex flex-col justify-end gap-lg">
          <p className="text-body text-text-secondary" data-reveal>
            Organised by {event.organiser}, {event.organiserDescription}. Plan, build, earn and
            inspire.
          </p>
        </div>
      </div>
      <dl className="grid gap-px overflow-hidden rounded-sm border border-border-subtle bg-border-subtle md:grid-cols-3">
        {stats.map(([value, label]) => (
          <div key={label} className="flex flex-col gap-xs bg-bg-canvas p-xl" data-reveal>
            <dt className="order-2 text-body-sm text-text-muted">{label}</dt>
            <dd className="order-1 font-display text-heading-2 text-text-primary tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
