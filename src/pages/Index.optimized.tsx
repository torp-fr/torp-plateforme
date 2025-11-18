/**
 * Optimized Landing Page
 * Complete UX/UI redesign with conversion-focused layout
 */

import { Header } from "@/components/Header.optimized";
import { Hero } from "@/components/Hero.optimized";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Solutions } from "@/components/landing/Solutions";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Solutions />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
