import type { Metadata } from "next";
import { Footer } from "@/components/home/footer";
import { RegistrationForm } from "@/components/register/registration-form";
import { HeistBoard } from "@/components/register/heist-board";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { event, teamSizeLabel, venueLabel } from "@/config/event";

export const metadata: Metadata = {
  title: "Register your team · FinForge 2027",
  description: `Register your team of ${teamSizeLabel} for FinForge 2027, the fraud detection and cybersecurity hackathon at ${venueLabel}, ${event.dateLabel}.`,
  alternates: { canonical: "/register" },
};

/** Cloudflare's public "always passes" test key, used only outside production builds. */
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

function turnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (key) return key;
  return process.env.NODE_ENV === "production" ? null : TURNSTILE_TEST_SITE_KEY;
}

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-lg border border-border-frame p-lg md:p-2xl">
      <h2 className="font-display text-heading-2 text-text-primary">{title}</h2>
      <p className="max-w-[40rem] text-body-lg text-text-secondary">{body}</p>
      <ButtonLink href="/#timeline">See the timeline</ButtonLink>
    </div>
  );
}

export default function RegisterPage() {
  const siteKey = turnstileSiteKey();
  const state = event.registration;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-xs focus:left-xs focus:z-50 focus:rounded-xs focus:bg-bg-accent focus:px-md focus:py-xs focus:text-label focus:text-text-on-accent"
      >
        Skip to content
      </a>
      <SiteNav />
      {state === "coming-soon" ? (
        <main id="main" className="flex-1">
          <HeistBoard />
        </main>
      ) : (
        <main id="main" className="flex-1 px-gutter py-2xl md:py-4xl">
          <div className="mx-auto flex max-w-[48rem] flex-col gap-2xl">
            <header className="flex flex-col gap-md">
              <div>
                <Badge tone={state === "open" ? "accent" : "danger"}>
                  {state === "open" ? "Registrations open" : "Registrations closed"}
                </Badge>
              </div>
              <h1 className="font-display text-heading-1 text-text-primary">Register your team</h1>
              <p className="text-body-lg text-text-secondary">
                {event.name}, {event.dateLabel} at {venueLabel}. Teams of {teamSizeLabel}. The team
                leader fills this in once for the whole team.
              </p>
            </header>

            {state === "closed" && (
              <Closed
                title="Registration has closed"
                body={`Thanks for your interest in ${event.name}. Follow us on Instagram for results and future events.`}
              />
            )}
            {state === "open" &&
              (siteKey ? (
                <RegistrationForm siteKey={siteKey} />
              ) : (
                <Closed
                  title="Registration is temporarily unavailable"
                  body="We're fixing a problem with the form. Please try again in a little while."
                />
              ))}
          </div>
        </main>
      )}
      <Footer />
    </>
  );
}
