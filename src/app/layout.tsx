import type { Metadata } from "next";
import { bodoni, inter } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinForge 2027",
  description:
    "FinForge 2027 is a Fraud Detection and Cybersecurity hackathon by FinFoundry in Hyderabad, March 2027.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodoni.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
