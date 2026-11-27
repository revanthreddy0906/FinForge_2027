import Link from "next/link";
import { event, venueLabel } from "@/config/event";
import { navLinks } from "@/config/nav";
import { ContactPhones } from "../contact-phones";
import { Logo } from "../ui/logo";

const linkClass =
  "text-body-sm text-text-secondary transition-colors duration-(--duration-fast) ease-standard hover:text-text-primary";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-bg-canvas px-gutter py-3xl">
      <div className="mx-auto flex max-w-content flex-col gap-2xl">
        <div className="flex flex-col gap-2xl md:flex-row md:justify-between">
          <div className="flex max-w-[22rem] flex-col gap-md">
            <Logo />
            <p className="text-body-sm text-text-secondary">
              A {event.organiser} event. {event.tagline}.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-2xl">
            <div className="flex flex-col gap-sm">
              <p className="text-eyebrow text-text-muted uppercase">Event</p>
              <ul className="flex flex-col gap-xs">
                {navLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-sm">
              <p className="text-eyebrow text-text-muted uppercase">Connect</p>
              <ul className="flex flex-col gap-xs">
                <li>
                  <a
                    href={event.instagram.url}
                    className={linkClass}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Instagram<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              </ul>
              <ContactPhones />
            </div>
          </nav>
        </div>
        <div className="flex flex-col gap-xs border-t border-border-subtle pt-lg text-body-sm text-text-muted md:flex-row md:justify-between">
          <p>© 2027 {event.organiser}</p>
          <p>{venueLabel}</p>
        </div>
      </div>
    </footer>
  );
}
