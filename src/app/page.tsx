import { About } from "@/components/home/about";
import { Faq } from "@/components/home/faq";
import { Footer } from "@/components/home/footer";
import { Hero } from "@/components/home/hero";
import { Prizes } from "@/components/home/prizes";
import { Sponsors } from "@/components/home/sponsors";
import { Theme } from "@/components/home/theme";
import { Timeline } from "@/components/home/timeline";
import { SiteNav } from "@/components/site-nav";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-xs focus:left-xs focus:z-50 focus:rounded-xs focus:bg-bg-accent focus:px-md focus:py-xs focus:text-label focus:text-text-on-accent"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        <Hero />
        <About />
        <Theme />
        <Timeline />
        <Prizes />
        <Sponsors />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
