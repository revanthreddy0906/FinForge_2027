import type { CSSProperties } from "react";
import { event, teamSizeLabel, venueLabel } from "@/config/event";
import { Badge } from "../ui/badge";
import { ButtonLink } from "../ui/button";
import { Seal } from "./seal";

const statusBadge = {
  "coming-soon": { tone: "neutral", label: "Registration opens soon" },
  open: { tone: "accent", label: "Registrations open" },
  closed: { tone: "danger", label: "Registrations closed" },
} as const;

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/** Hero (docs/motion.md #1): one orchestrated CSS reveal; text is in the HTML from the start. */
export function Hero() {
  const badge = statusBadge[event.registration];
  const facts = [
    ["When", event.dateLabel],
    ["Where", venueLabel],
    ["Teams", teamSizeLabel],
  ] as const;

  return (
    <section aria-labelledby="hero-title" className="px-gutter py-2xl md:py-4xl">
      <div className="mx-auto flex max-w-content flex-col items-center gap-xl border border-border-frame px-lg py-xl md:flex-row md:gap-3xl md:p-3xl">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-lg md:order-1">
          <div className="hero-rise" style={i(0)}>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          <p className="hero-rise text-eyebrow text-text-accent uppercase" style={i(1)}>
            {event.organiser} presents
          </p>
          <h1 id="hero-title" className="flex flex-col">
            <span className="-mb-[0.15em] overflow-hidden pb-[0.15em]">
              <span
                className="hero-wipe block font-display text-display-xl text-text-primary"
                style={i(1)}
              >
                FinForge
              </span>
            </span>
            <span className="flex items-center gap-md">
              <span
                aria-hidden="true"
                className="hero-draw h-px w-10 bg-border-frame md:w-24"
                style={i(3)}
              />
              <span
                className="hero-rise font-display text-display-lg text-text-accent"
                style={i(3)}
              >
                2027
              </span>
            </span>
          </h1>
          <p className="hero-rise max-w-[36rem] text-body-lg text-text-secondary" style={i(4)}>
            {event.format}: two days and a {String(event.hackathonHours)}-hour hackathon on fraud
            detection and cybersecurity. Only {String(event.teamCount)} teams. Build the systems
            that keep money safe.
          </p>
          <dl className="hero-rise flex flex-col gap-md md:flex-row md:gap-xl" style={i(5)}>
            {facts.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-2xs">
                <dt className="text-eyebrow text-text-muted uppercase">{k}</dt>
                <dd className="text-label text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="hero-rise flex flex-col gap-sm md:flex-row" style={i(6)}>
            {event.registration !== "closed" ? (
              <ButtonLink href={event.registrationPath}>Register your team</ButtonLink>
            ) : (
              <ButtonLink href="#timeline">Get the timeline</ButtonLink>
            )}
            <ButtonLink href="#faq" variant="secondary">
              Read the FAQ
            </ButtonLink>
          </div>
        </div>
        <div className="order-1 md:order-2">
          <Seal />
        </div>
      </div>
    </section>
  );
}
