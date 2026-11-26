"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_ACTION } from "@/lib/registration/turnstile-check";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "flexible" | "compact";
      "response-field-name"?: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | undefined;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    // Pass on the page's CSP nonce (browsers expose it only as a property). strict-dynamic already
    // allows this script; Turnstile also copies the nonce to anything it adds to the page.
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    if (nonce) script.nonce = nonce;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileProps {
  siteKey: string;
  /** Changes to this value reset the widget (a token can only be used once). */
  resetSignal: number;
  onToken: (token: string | null) => void;
  onLoadError: () => void;
}

/**
 * Cloudflare Turnstile bot check. The widget adds a hidden `cf-turnstile-response` input to the
 * surrounding form, which the server action verifies.
 */
export function Turnstile({ siteKey, resetSignal, onToken, onLoadError }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | undefined>(undefined);
  const callbacks = useRef({ onToken, onLoadError });

  useEffect(() => {
    callbacks.current = { onToken, onLoadError };
  });

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        const el = containerRef.current;
        if (cancelled || !el || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(el, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          theme: "dark",
          size: "flexible",
          callback: (token) => {
            callbacks.current.onToken(token);
          },
          "expired-callback": () => {
            callbacks.current.onToken(null);
          },
          "error-callback": () => {
            callbacks.current.onToken(null);
          },
        });
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onLoadError();
      });
    return () => {
      cancelled = true;
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current);
      widgetRef.current = undefined;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetRef.current) {
      window.turnstile?.reset(widgetRef.current);
      callbacks.current.onToken(null);
    }
  }, [resetSignal]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
