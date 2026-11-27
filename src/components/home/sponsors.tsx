import { event } from "@/config/event";
import { ContactCards } from "../contact-phones";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

export function Sponsors() {
  const hasSponsors = event.sponsors.length > 0;
  return (
    <Section id="sponsors" labelledBy="sponsors-title">
      <SectionHeader
        id="sponsors-title"
        index="05"
        eyebrow="Sponsors"
        title={hasSponsors ? "Backed by" : "Partners to be announced"}
        description="Want your team in front of students building fraud and security tools? Write to the club or call the organisers."
      />
      <ul className="grid grid-cols-2 gap-lg md:grid-cols-4">
        {hasSponsors
          ? event.sponsors.map((s) => (
              <li key={s.name} data-reveal>
                <a
                  href={s.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="grid h-24 place-items-center rounded-sm border border-border-subtle text-label text-text-primary"
                >
                  {s.name}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))
          : [1, 2, 3, 4].map((n) => (
              <li
                key={n}
                data-reveal
                className="grid h-24 place-items-center rounded-sm border border-dashed border-border-default text-body-sm text-text-muted"
              >
                Sponsor TBA
              </li>
            ))}
      </ul>
      <ContactCards />
    </Section>
  );
}
