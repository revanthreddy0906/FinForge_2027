import { event } from "@/config/event";
import { formatINR } from "@/lib/format-inr";
import { CountUp } from "../motion/count-up";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

export function Prizes() {
  return (
    <Section id="prizes" labelledBy="prizes-title" tone="surface">
      <SectionHeader id="prizes-title" index="04" eyebrow="Prizes" title="Worth building for" />
      <div
        className="flex flex-col gap-lg border border-border-frame bg-bg-canvas p-xl md:flex-row md:items-end md:justify-between md:p-3xl"
        data-reveal
      >
        <div className="flex flex-col gap-sm">
          <p className="text-eyebrow text-text-accent uppercase">Total prize pool</p>
          <p className="font-display text-numeral text-text-primary tabular-nums">
            <CountUp value={event.prizePool} />
          </p>
        </div>
        {event.prizeBreakdown ? (
          <ul className="flex flex-col gap-xs text-body text-text-secondary">
            {event.prizeBreakdown.map((p) => (
              <li key={p.label}>
                {p.label}: {formatINR(p.amount)}
              </li>
            ))}
          </ul>
        ) : (
          // TODO: prize breakdown by position and track.
          <p className="max-w-[22rem] text-body text-text-secondary">
            The split by position and track is announced with the problem statements.
          </p>
        )}
      </div>
    </Section>
  );
}
