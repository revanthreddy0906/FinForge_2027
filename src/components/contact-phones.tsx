import { event } from "@/config/event";
import { ContactEmail } from "./contact-email";

const cell = "flex flex-col gap-md bg-bg-canvas p-lg md:p-xl";

/**
 * "Partner with us" panel: one card per organiser (full name, role, tap-to-call number) and
 * the club email, in the same ruled grid as the About stats.
 */
export function ContactCards() {
  return (
    <div className="flex flex-col gap-lg" data-reveal>
      <h3 className="font-display text-heading-3 text-text-primary">Partner with us</h3>
      <ul className="grid gap-px overflow-hidden rounded-sm border border-border-frame bg-border-subtle md:grid-cols-3">
        {event.contacts.map((c) => (
          <li key={c.phone} className={cell}>
            <div className="flex flex-col gap-2xs">
              <p className="text-eyebrow text-text-accent uppercase">{c.role}</p>
              <p className="font-display text-heading-3 text-text-primary">{c.name}</p>
            </div>
            <a
              href={`tel:${c.phone}`}
              className="mt-auto inline-flex items-center gap-xs text-label text-text-primary tabular-nums underline decoration-border-frame underline-offset-4 hover:text-text-accent"
            >
              <span aria-hidden="true">☎</span>
              <span>
                <span className="sr-only">Call {c.name} on </span>
                {c.phoneLabel}
              </span>
            </a>
          </li>
        ))}
        <li className={cell}>
          <div className="flex flex-col gap-2xs">
            <p className="text-eyebrow text-text-accent uppercase">Club email</p>
            <p className="font-display text-heading-3 text-text-primary">{event.organiser}</p>
          </div>
          <div className="mt-auto">
            <ContactEmail />
          </div>
        </li>
      </ul>
    </div>
  );
}

/** Compact organiser list for the footer: full name, then the tap-to-call number. */
export function ContactPhones() {
  return (
    <ul className="flex flex-col gap-sm">
      {event.contacts.map((c) => (
        <li key={c.phone} className="flex flex-col">
          <span className="text-body-sm text-text-primary">{c.name}</span>
          <a
            href={`tel:${c.phone}`}
            className="text-body-sm text-text-secondary tabular-nums transition-colors duration-(--duration-fast) ease-standard hover:text-text-primary"
          >
            <span className="sr-only">Call {c.name} on </span>
            {c.phoneLabel}
          </a>
        </li>
      ))}
    </ul>
  );
}
