"use client";

import { AboutSection } from "@/components/landing/AboutSection";
import { CatalogueSection } from "@/components/landing/CatalogueSection";
import { ContactSection } from "@/components/landing/ContactSection";
import { FullPager, type SectionDef } from "@/components/landing/FullPager";
import { HeroSection } from "@/components/landing/HeroSection";
import { Nav } from "@/components/landing/Nav";
import { SectionDots } from "@/components/landing/SectionDots";
import { useFullpage } from "@/hooks/useFullpage";

const SECTIONS: SectionDef[] = [
  { id: "generate", label: "Generate" },
  { id: "about", label: "About" },
  { id: "catalogue", label: "Catalogue" },
  { id: "contact", label: "Contact" },
];

export default function LandingPage() {
  const { index, goTo, step } = useFullpage(SECTIONS.length);

  return (
    <main>
      <Nav sections={SECTIONS} index={index} goTo={goTo} />
      <SectionDots sections={SECTIONS} index={index} goTo={goTo} />
      <FullPager sections={SECTIONS} index={index} goTo={goTo} step={step}>
        {[
          <HeroSection key="generate" goToCatalogue={() => goTo(2)} />,
          <AboutSection key="about" active={index === 1} />,
          <CatalogueSection key="catalogue" active={index === 2} />,
          <ContactSection key="contact" active={index === 3} />,
        ]}
      </FullPager>
    </main>
  );
}
