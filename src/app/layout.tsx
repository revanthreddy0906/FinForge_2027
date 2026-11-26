import type { Metadata } from "next";
import { connection } from "next/server";
import { bodoni, inter } from "./fonts";
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
    "FinForge 2027 is a Fraud Detection and Cybersecurity hackathon by FinFoundry in Hyderabad, March 2027.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="en" className={`${bodoni.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
