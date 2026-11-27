import { event } from "@/config/event";

/** The organizer contacts from the event config, as tap-to-call links. */
export function ContactPhones({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-col gap-xs ${className}`}>
      {event.contacts.map((c) => (
        <li key={c.phone} className="text-body-sm text-text-secondary">
          {c.name}:{" "}
          <a
            href={`tel:${c.phone}`}
            className="text-text-primary tabular-nums underline decoration-border-frame underline-offset-4"
          >
            {c.phoneLabel}
          </a>
        </li>
      ))}
    </ul>
  );
}
