import { Bodoni_Moda, Inter } from "next/font/google";

/** Display face: Didone serif that echoes the FinForge wordmark (token `font/display`). */
export const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bodoni",
});

/** Body and UI face (token `font/body`). */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
