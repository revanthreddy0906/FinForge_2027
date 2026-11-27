import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { event, teamSizeLabel, venueLabel } from "@/config/event";
import { formatINR } from "@/lib/format-inr";
import { EyeTracker } from "./eye-tracker";
import {
  ArrowArt,
  BanditArt,
  BugArt,
  BugTrail,
  CameraArt,
  CameraCone,
  FingerprintArt,
  HookArt,
  LasersArt,
  RoughFilter,
  ShieldArt,
  SparkleArt,
} from "./heist-doodles";
import { VaultGame } from "./vault-game";
import { WideOnly } from "./wide-only";

/**
 * /register while registration is "coming soon": the Heist Board. The vault game sits in
 * the middle of a hand-drawn security scene. Wide screens (72rem+) spread the doodles into
 * the margins; narrower ones hang a lighter set around the dial.
 */

const d = (i: number) => ({ "--i": i }) as CSSProperties;

function Note({
  className,
  children,
  style,
}: {
  className: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <p className={`hand-note leading-tight absolute whitespace-nowrap ${className}`} style={style}>
      {children}
    </p>
  );
}

function HouseRules({ className }: { className: string }) {
  return (
    <div
      className={`absolute w-52 bg-bg-accent px-md pt-md pb-lg text-text-on-accent shadow-none ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-2 bg-[var(--yellow-600)]" />
      <p className="hand-note text-heading-4">House rules</p>
      <ol className="mt-xs flex flex-col gap-2xs text-body-sm">
        <li>1. No brute force</li>
        <li>2. No backdoors</li>
        <li>3. Bring your team ({teamSizeLabel.replace(" members", "")})</li>
      </ol>
    </div>
  );
}

const prize = formatINR(event.prizePool);

/** Margin doodles for wide screens, placed on a 1440 x 1060 artboard. */
function WideDoodles() {
  return (
    <div aria-hidden="true" className="heist-appear pointer-events-none absolute inset-0">
      <div className="relative mx-auto h-full max-w-[90rem]">
        <CameraArt className="heist-bob absolute top-[4.5rem] left-[7%] w-52" />
        <CameraCone className="absolute top-[10.5rem] left-[19.5%] w-60 opacity-80" />
        <Note className="top-[13rem] left-[6%] -rotate-6 text-heading-4 text-text-accent">
          smile, you&apos;re on camera
        </Note>

        <HookArt className="heist-sway absolute top-0 left-[80.5%] w-32" style={d(1)} />
        <Note className="top-[14rem] left-[89.5%] rotate-6 text-heading-4 text-text-accent">
          not today,
          <br />
          phishers
        </Note>

        <FingerprintArt className="heist-bob absolute top-[26rem] left-[19%] w-14" style={d(2)} />
        <HouseRules className="heist-bob top-[40rem] left-[8%] -rotate-[5deg]" />

        <Note className="top-[25.5rem] left-[76%] text-heading-3 text-text-primary">
          {prize} in prizes
        </Note>
        <Note className="top-[28rem] left-[78%] text-body-lg text-text-secondary">
          is somewhere in here
        </Note>
        <ArrowArt className="absolute top-[29.5rem] left-[66%] w-40" />

        <p className="absolute top-[38rem] left-[84%] font-body text-body-sm tracking-[0.3em] text-decor-rupee">
          01100110 01101001
          <br />
          01101110
        </p>
        <BanditArt className="heist-peek absolute top-[47rem] left-[67%] w-44" />
        <ShieldArt className="heist-bob absolute top-[55rem] left-[86%] w-20" style={d(3)} />

        <SparkleArt className="heist-twinkle absolute top-[19rem] left-[32%] w-5" style={d(0)} />
        <SparkleArt className="heist-twinkle absolute top-[16rem] left-[68%] w-4" style={d(2)} />
        <SparkleArt className="heist-twinkle absolute top-[59rem] left-[61%] w-4" style={d(4)} />
      </div>
    </div>
  );
}

/**
 * The lighter set for phones and tablets, hung around the dial's square. Phones keep them tight
 * to the dial; tablets have side margins, so md moves each one out of the dial's way.
 */
function NarrowDoodles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 aspect-square min-[72rem]:hidden"
    >
      <CameraArt className="heist-bob absolute -top-[21%] -left-[6%] w-[38%] md:-top-[16%] md:-left-[34%] md:w-[30%]" />
      <Note className="-top-[13%] left-[30%] -rotate-[5deg] text-body text-text-accent md:-top-[17%] md:left-[22%] md:text-body-lg">
        smile, you&apos;re on camera
      </Note>
      <HookArt
        className="heist-sway absolute -top-[30%] -right-[4%] w-[22%] md:-top-[26%] md:-right-[26%] md:w-[18%]"
        style={d(1)}
      />
      <BanditArt className="heist-peek absolute top-[84%] -left-[10%] w-[32%] md:top-[78%] md:-left-[36%] md:w-[28%]" />
      <div
        className="heist-bob absolute top-[56%] -right-[9%] w-28 rotate-[7deg] bg-bg-accent px-sm py-xs text-left text-text-on-accent md:top-[44%] md:-right-[38%] md:w-32"
        style={d(2)}
      >
        <p className="hand-note text-heading-4">{prize}</p>
        <p className="leading-tight text-body-sm">in prizes, somewhere in here</p>
      </div>
      <SparkleArt
        className="heist-twinkle absolute top-[22%] -left-[4%] w-4 md:-left-[14%]"
        style={d(1)}
      />
      <SparkleArt
        className="heist-twinkle absolute top-[52%] -right-[5%] w-3 md:top-[86%] md:-right-[16%]"
        style={d(3)}
      />
    </div>
  );
}

export function HeistBoard() {
  return (
    <section
      data-heist
      aria-labelledby="heist-heading"
      className="heist relative isolate overflow-hidden"
    >
      <RoughFilter />
      <div aria-hidden="true" className="heist-grid absolute inset-0 -z-10" />
      <div aria-hidden="true" className="heist-lasers absolute -inset-x-[5%] inset-y-0 -z-10">
        <LasersArt className="size-full" />
      </div>
      <WideOnly>
        <WideDoodles />
      </WideOnly>

      <div className="relative flex flex-col items-center px-gutter pt-2xl pb-[9rem] text-center md:pt-3xl min-[72rem]:min-h-[66rem]">
        <Badge>Registration opens soon</Badge>
        <h1
          id="heist-heading"
          className="mt-lg font-display text-display-lg text-text-primary md:text-[4.5rem] md:leading-[4.75rem]"
        >
          The vault opens <span className="hand-note text-text-accent">soon.</span>
        </h1>
        <p className="mt-md max-w-[36rem] text-body-lg text-text-secondary">
          {event.name} · {event.dateLabel} · {venueLabel}. Teams of {teamSizeLabel}. Until
          registration unlocks, try your luck on the dial.
        </p>

        <div className="relative mt-[5.5rem] w-full max-w-72 md:mt-[7rem] md:max-w-104 min-[72rem]:mt-2xl">
          <NarrowDoodles />
          <VaultGame dateLabel={event.dateLabel} />
        </div>

        <div className="mt-xl flex flex-col items-center gap-sm md:flex-row">
          <a
            href={event.instagram.url}
            className={buttonClasses("primary")}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>Follow @{event.instagram.handle} for the launch date</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <ButtonLink href="/#timeline" variant="ghost">
            See the timeline
          </ButtonLink>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-lg left-1/2 flex w-[min(40rem,100%)] -translate-x-1/2 items-center gap-sm px-gutter min-[72rem]:left-[38%]"
      >
        <BugTrail className="hidden w-40 md:block" />
        <BugArt className="heist-crawl w-12 shrink-0" />
        <p className="hand-note text-body-sm text-text-muted md:text-body-lg">
          a bug. our hackers squash these for fun
        </p>
      </div>
      <EyeTracker />
    </section>
  );
}
