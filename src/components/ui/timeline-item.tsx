export type TimelineStatus = "past" | "current" | "upcoming";

interface TimelineItemProps {
  title: string;
  description: string;
  dateLabel: string;
  dateTime?: string | null;
  status: TimelineStatus;
}

const markers = new Map<TimelineStatus, string>([
  ["past", "bg-decor-diamond"],
  ["current", "bg-bg-accent"],
  ["upcoming", "border border-border-strong bg-bg-canvas"],
]);

/** Figma "Timeline item". The rail line is drawn by the parent list. */
export function TimelineItem({
  title,
  description,
  dateLabel,
  dateTime,
  status,
}: TimelineItemProps) {
  return (
    <li
      className="timeline-item relative grid grid-cols-[1rem_1fr] gap-lg pb-xl"
      aria-current={status === "current" ? "step" : undefined}
    >
      <span aria-hidden="true" className="relative flex justify-center pt-1">
        <span
          className={`timeline-marker block size-[0.6875rem] rotate-45 ${markers.get(status) ?? ""}`}
        />
      </span>
      <div className="flex flex-col gap-xs">
        <p
          className={`text-eyebrow uppercase ${status === "current" ? "text-text-accent" : "text-text-muted"}`}
        >
          {dateTime ? <time dateTime={dateTime}>{dateLabel}</time> : dateLabel}
        </p>
        <h3 className="font-display text-heading-3 text-text-primary">{title}</h3>
        <p className="text-body text-text-secondary">{description}</p>
      </div>
    </li>
  );
}
