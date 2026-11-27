import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { connection } from "next/server";
import { bodoni, bodoniItalic, inter } from "./fonts";
import "./globals.css";

/**
 * Every page renders per request so Next.js can stamp the request's CSP nonce on its scripts
 * (see docs/adr/0002-content-security-policy.md). The root layout waits for the request and is
 * allowed to block, so no static shell is prerendered without a nonce.
 */
export const instant = false;

export const metadata: Metadata = {
  title: "FinForge 2027",
  description:
    "FinForge 2027 by CBIT FinFoundry: Hyderabad's first AI x FinTech innovation festival, with a 24-hour fraud detection and cybersecurity hackathon at JHCC, 20–21 March 2027.",
};

/**
 * Vercel serves the Web Analytics and Speed Insights scripts from /_vercel/* only on its own
 * platform, so local and CI builds (where those paths 404) leave them out.
 */
const onVercel = process.env.VERCEL === "1";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${bodoniItalic.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {/* Cookieless, first-party (/_vercel/*) and loaded after the page; see docs/deployment.md. */}
        {onVercel ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
