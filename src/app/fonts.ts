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

/**
 * Italic Bodoni for the hand-written notes on the "coming soon" vault page. Declared in the
 * root layout so its @font-face ships in the main stylesheet, but not preloaded: the files only
 * download on pages that use it.
 */
export const bodoniItalic = Bodoni_Moda({
  subsets: ["latin"],
  style: "italic",
  display: "swap",
  preload: false,
  variable: "--font-bodoni-italic",
});
