"use client";

import { useState } from "react";
import { Button } from "./ui/button";

// The club's official address, stored reversed and split so it never appears in the
// HTML or as one string in the bundle. A contact form (rate limited + Turnstile)
// replaces this as the main channel in a later step.
const parts = ["moc.liamg", "7202.yrdnuofnif.tibc"] as const;
const reveal = () =>
  `${parts[1].split("").reverse().join("")}@${parts[0].split("").reverse().join("")}`;

/** Shows the club's email only after a click, so scrapers don't get it from the page. */
export function ContactEmail({ variant = "secondary" }: { variant?: "secondary" | "ghost" }) {
  const [email, setEmail] = useState<string | null>(null);
  if (email) {
    return (
      <a
        href={`mailto:${email}`}
        className="text-label text-text-accent underline decoration-border-frame underline-offset-4"
      >
        {email}
      </a>
    );
  }
  return (
    <Button
      variant={variant}
      onClick={() => {
        setEmail(reveal());
      }}
    >
      Show club email
    </Button>
  );
}
