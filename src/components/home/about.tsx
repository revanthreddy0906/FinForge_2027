import { event } from "@/config/event";
import { formatINR } from "@/lib/format-inr";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

/** "Why FinForge", from the official event document. */
const reasons = [
  {
    title: "The first of its kind",
    body: "Hyderabad's first festival to bring AI, FinTech and a competitive hackathon together at this scale.",
  },
  {
    title: "The city's best builders, in one room",
    body: `Top engineers from ${String(event.collegeCount)} leading institutions, working on real problems in finance.`,
  },
  {
    title: "Industry leaders, up close",
    body: "Leaders from finance and technology share their expertise through talks, mentorship and judging, with direct access for those hungry to learn.",
  },
  {
    title: "A founder's story, first-hand",
    body: "A signature session with a young tech startup founder: ask anything, learn how they started, and see what's possible at your age.",
  },
  {
    title: "Mentorship that moves the needle",
    body: "Expert guidance while ideas become working products.",
  },
  {
    title: "Connections that last",
    body: "Ambitious young minds from across Hyderabad meet and build relationships that shape careers and companies.",
  },
] as const;

export function About() {
  const stats = [
    [formatINR(event.prizePool), "Prize pool"],
    [String(event.teamCount), "Teams"],
    [`${String(event.hackathonHours)} hrs`, "Hackathon"],
    [`${String(event.team.minSize)}–${String(event.team.maxSize)}`, "Members per team"],
  ] as const;

  return (
    <Section id="about" labelledBy="about-title">
      <div className="grid gap-2xl lg:grid-cols-[1.2fr_1fr] lg:gap-3xl">
        <SectionHeader
          id="about-title"
          index="01"
          eyebrow="About"
          title={event.headline}
          description={`${event.name}, the flagship event of ${event.organiser}, is a two-day innovation festival at ${event.venue.name}, built around a ${String(event.hackathonHours)}-hour AI FinTech hackathon. Student engineers from ${String(event.collegeCount)} of the city's top engineering colleges come together to compete, build and connect.`}
        />
        <div className="flex flex-col justify-end gap-lg">
          <p className="text-body text-text-secondary" data-reveal>
            But this is much bigger than a hackathon. It&apos;s a place where talent, industry and
            opportunity meet. Don&apos;t compete to be in the top 5, or the top 10.{" "}
            <strong className="font-semibold text-text-primary">Compete to be the best.</strong>
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border-subtle bg-border-subtle xl:grid-cols-4">
        {stats.map(([value, label]) => (
          <div
            key={label}
            className="flex min-w-0 flex-col gap-xs bg-bg-canvas p-md sm:p-lg md:p-xl"
            data-reveal
          >
            <dt className="order-2 text-body-sm text-text-muted">{label}</dt>
            {/* 7vw keeps "₹3,00,000" inside a half-width cell on 320px phones. */}
            <dd className="order-1 font-display text-heading-2 whitespace-nowrap text-text-primary tabular-nums max-md:text-[min(var(--text-heading-2),7vw)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-lg">
        <h3 className="font-display text-heading-3 text-text-primary" data-reveal>
          Why FinForge
        </h3>
        <ul className="grid gap-lg md:grid-cols-2 lg:grid-cols-3">
          {reasons.map((r) => (
            <li
              key={r.title}
              className="flex flex-col gap-xs border-t border-border-default pt-md"
              data-reveal
            >
              <p className="text-label text-text-primary">{r.title}</p>
              <p className="text-body text-text-secondary">{r.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
