"use client";

import { useId, useState, type ReactNode } from "react";

interface FaqItemProps {
  question: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/**
 * Figma "FAQ item": a disclosure button with aria-expanded controlling a region.
 * Only transform and opacity animate; the answer's height changes instantly.
 */
export function FaqItem({ question, children, defaultOpen = false }: FaqItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const buttonId = `${id}-q`;
  const panelId = `${id}-a`;

  return (
    <div className="border-b border-border-default">
      <h3 className="text-heading-4">
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((v) => !v);
          }}
          className="flex w-full items-center gap-md py-lg text-left text-text-primary"
        >
          <span className="flex-1">{question}</span>
          <span aria-hidden="true" className="relative size-6 shrink-0 text-text-accent">
            <span className="absolute top-1/2 left-[5px] h-[1.5px] w-3.5 -translate-y-1/2 bg-current" />
            <span
              className={
                "absolute top-[5px] left-1/2 h-3.5 w-[1.5px] -translate-x-1/2 bg-current " +
                "transition-[transform,opacity] duration-(--duration-base) ease-in-out " +
                (open ? "rotate-90 opacity-0" : "")
              }
            />
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="faq-answer pb-lg text-body text-text-secondary"
      >
        {children}
      </div>
    </div>
  );
}
