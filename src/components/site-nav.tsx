"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { event } from "@/config/event";
import { navLinks } from "@/config/nav";
import { ButtonLink } from "./ui/button";
import { Logo } from "./ui/logo";

function NavCta({ className }: { className?: string }) {
  return event.registration === "open" ? (
    <ButtonLink href={event.registrationPath} className={className}>
      Register
    </ButtonLink>
  ) : (
    <ButtonLink href="#timeline" className={className}>
      Key dates
    </ButtonLink>
  );
}

/** Figma "Nav": sticky bar; on mobile a menu button opens a full-height panel. */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // Keep keyboard and screen-reader focus inside the open menu.
    const behind = Array.from(
      document.querySelectorAll<HTMLElement>("body > :not(header, script, next-route-announcer)"),
    );
    for (const el of behind) el.inert = true;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      for (const el of behind) el.inert = false;
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
  };

  return (
    <header
      className={
        "sticky top-0 z-50 border-b bg-bg-canvas transition-colors duration-(--duration-fast) " +
        (scrolled || open ? "border-border-subtle" : "border-transparent")
      }
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-content items-center justify-between px-gutter md:h-20"
      >
        <Link href="/" onClick={close}>
          <Logo />
        </Link>
        <ul className="hidden items-center gap-xl md:flex">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-label text-text-secondary transition-colors duration-(--duration-fast) hover:text-text-primary"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
          <NavCta />
        </div>
        <button
          ref={buttonRef}
          type="button"
          className="relative grid size-11 place-items-center rounded-xs border border-border-strong md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => {
            setOpen((v) => !v);
          }}
        >
          <span
            aria-hidden="true"
            className={
              "absolute h-[1.5px] w-5 bg-text-primary transition-transform duration-(--duration-base) ease-in-out " +
              (open ? "rotate-45" : "-translate-y-1")
            }
          />
          <span
            aria-hidden="true"
            className={
              "absolute h-[1.5px] w-5 bg-text-primary transition-transform duration-(--duration-base) ease-in-out " +
              (open ? "-rotate-45" : "translate-y-1")
            }
          />
        </button>
      </nav>
      <div
        id="mobile-menu"
        hidden={!open}
        className="mobile-menu fixed inset-x-0 top-16 bottom-0 overflow-y-auto bg-bg-canvas px-gutter py-xl md:hidden"
      >
        <ol className="flex flex-col gap-lg">
          {navLinks.map((l, i) => (
            <li key={l.href} className="menu-item" style={{ "--i": i } as CSSProperties}>
              <a
                href={l.href}
                onClick={close}
                className="flex items-baseline gap-md text-text-primary"
              >
                <span className="text-eyebrow text-text-muted">{`0${String(i + 1)}`}</span>
                <span className="font-display text-heading-2">{l.label}</span>
              </a>
            </li>
          ))}
        </ol>
        <div className="menu-item mt-xl" style={{ "--i": navLinks.length } as CSSProperties}>
          <NavCta className="w-full" />
        </div>
      </div>
    </header>
  );
}
