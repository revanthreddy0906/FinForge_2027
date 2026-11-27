import { event } from "@/config/event";
import { Card } from "../ui/card";
import { SectionHeader } from "../ui/section-header";
import { Section } from "./section";

/** "The problem in numbers", from the official event document. */
const numbers = [
  ["2,000%+", "rise in deepfake fraud attempts against financial services since 2022"],
  ["92%", "of financial institutions report fraudsters using generative AI"],
  ["€100M", "in fraudulent transfers in the reported Crédit Mutuel Arkéa cyberattack"],
] as const;

/** "Come prepared": the four areas teams should know before the problem statements are revealed. */
const areas = [
  {
    title: "How fraud works",
    body: "Deepfakes and voice cloning, synthetic identities, KYC bypass, account takeover, mule accounts, and attacks on AI systems themselves.",
  },
  {
    title: "How it is detected",
    body: "Rules versus machine learning, anomaly detection, supervised models, graph analytics for fraud rings, behavioral biometrics, and KYC/AML fundamentals.",
  },
  {
    title: "What separates strong solutions",
    body: "Handling class imbalance, metrics beyond accuracy (precision, recall, PR-AUC), weighing missed fraud against blocked customers, real-time constraints, explainability, fairness, privacy, and models that decay as fraudsters adapt.",
  },
  {
    title: "The financial and regulatory context",
    body: "How fraud hits profit and reputation, how breaches move markets, who bears liability, and how regulators are responding, including in India.",
  },
] as const;

export function Theme() {
  return (
    <Section id="theme" labelledBy="theme-title" tone="surface">
      <SectionHeader
        id="theme-title"
        index="02"
        eyebrow="Theme"
        title={event.theme}
        description="Fighting AI-powered financial crime. With AI. Fraud no longer depends on stolen passwords and forged IDs. It runs on deepfakes, cloned voices, synthetic identities and automated attacks. FinForge 2027 challenges you to build the defences."
      />

      <div className="flex flex-col gap-md">
        <dl className="grid gap-px overflow-hidden rounded-sm border border-border-subtle bg-border-subtle md:grid-cols-3">
          {numbers.map(([value, label]) => (
            <div key={value} className="flex flex-col gap-xs bg-bg-canvas p-lg md:p-xl" data-reveal>
              <dt className="order-2 text-body-sm text-text-secondary">{label}</dt>
              <dd className="order-1 font-display text-heading-2 text-text-primary tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-body-sm text-text-muted" data-reveal>
          Sources: Backbase (2026), Feedzai (2025), Science Times (Nov 2026).
        </p>
      </div>

      <div className="grid gap-lg lg:grid-cols-[1fr_1.4fr] lg:gap-3xl" data-reveal>
        <h3 className="font-display text-heading-3 text-text-primary">In the markets today</h3>
        <p className="text-body text-text-secondary">
          French bank Crédit Mutuel Arkéa confirmed a cyberattack involving fraudulent transfers of
          about €100 million, with attackers reportedly targeting the bank&apos;s own accounts
          rather than its customers. Fraud and cybersecurity are now balance-sheet risks, not just
          IT problems. Banks are responding with behavioral monitoring, anomaly detection and
          millisecond sanctions screening. The race between attackers and defenders is the arena you
          will compete in.
        </p>
      </div>

      <div className="flex flex-col gap-lg">
        <div className="flex max-w-[45rem] flex-col gap-sm" data-reveal>
          <h3 className="font-display text-heading-3 text-text-primary">Come prepared</h3>
          <p className="text-body text-text-secondary">
            Problem statements are revealed minutes before the timer starts. Arrive fluent in these
            four areas.
          </p>
        </div>
        <div className="grid gap-lg md:grid-cols-2">
          {areas.map((a, i) => (
            <Card
              key={a.title}
              eyebrow={`Area ${String(i + 1)}`}
              title={a.title}
              highlight={i === 0}
            >
              {a.body}
            </Card>
          ))}
        </div>
      </div>

      <dl className="grid gap-lg border-t border-border-default pt-xl md:grid-cols-2" data-reveal>
        <div className="flex flex-col gap-xs">
          <dt className="text-eyebrow text-text-accent uppercase">Judged on</dt>
          <dd className="text-body-lg text-text-primary">{event.judgingCriteria.join(" · ")}</dd>
        </div>
        <div className="flex flex-col gap-xs">
          <dt className="text-eyebrow text-text-accent uppercase">Judged by</dt>
          <dd className="text-body-lg text-text-primary">
            A panel of leading minds from finance and technology.
          </dd>
        </div>
      </dl>
    </Section>
  );
}
