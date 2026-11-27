import { event, teamSizeLabel, venueLabel } from "@/config/event";
import { FaqItem } from "../ui/faq-item";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

const faqs = [
  {
    q: "Who can take part?",
    a: `College students, in teams of ${teamSizeLabel}. One person registers the whole team. Only ${String(event.teamCount)} teams compete.`,
  },
  {
    q: "How big can a team be?",
    a: `At least ${String(event.team.minSize)} and at most ${String(event.team.maxSize)} members, including the team leader.`,
  },
  {
    q: "Where and when is it?",
    a: `${venueLabel}, on ${event.dateLabel}. It's a two-day festival with a ${String(event.hackathonHours)}-hour hackathon at its centre.`,
  },
  {
    q: "When do we get the problem statements?",
    a: "Minutes before the timer starts. Come prepared on how fraud works, how it's detected, what makes a strong solution, and the financial and regulatory context.",
  },
  {
    q: "How are projects judged?",
    a: `On ${event.judgingCriteria.join(", ").toLowerCase()}, by a panel from finance and technology.`,
  },
  {
    q: "When does registration open?",
    a: "Registration dates are announced soon. This page will show a Register button once it opens.",
  },
] as const;

export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-title" tone="surface">
      <div className="grid gap-2xl md:grid-cols-[1fr_1.4fr] md:gap-3xl">
        <SectionHeader id="faq-title" index="06" eyebrow="FAQ" title="Questions, answered" />
        <div className="border-t border-border-default" data-reveal>
          {faqs.map((f, i) => (
            <FaqItem key={f.q} question={f.q} defaultOpen={i === 0}>
              {f.a}
            </FaqItem>
          ))}
        </div>
      </div>
    </Section>
  );
}
