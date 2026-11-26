/** Home page sections, shared by the header and the footer. Rooted at "/" so they work from any page. */
export const navLinks = [
  { href: "/#about", label: "About" },
  { href: "/#theme", label: "Theme" },
  { href: "/#timeline", label: "Timeline" },
  { href: "/#prizes", label: "Prizes" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#faq", label: "FAQ" },
] as const;
