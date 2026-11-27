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
        className="flex flex-col gap-lg border border-border-frame bg-bg-canvas p-lg sm:p-xl md:p-2xl lg:flex-row lg:items-end lg:justify-between lg:gap-2xl xl:p-3xl"
        data-reveal
      >
        <div className="flex flex-col gap-sm">
          <p className="text-eyebrow text-text-accent uppercase">Total prize pool</p>
          <p className="font-display text-numeral text-text-primary tabular-nums max-[22rem]:text-[3rem]">
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
          <div className="flex max-w-[24rem] flex-col gap-sm text-body text-text-secondary">
            <p>Plus {event.prizeExtras}. The split by position is announced soon.</p>
            <p>With only {String(event.teamCount)} teams competing, every seat counts.</p>
          </div>
        )}
      </div>
    </Section>
  );
}
