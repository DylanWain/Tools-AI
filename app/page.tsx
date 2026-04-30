import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { VeronumDemo } from "@/components/VeronumDemo";
import { LatestReleases } from "@/components/LatestReleases";
import { FeatureSection } from "@/components/FeatureSection";
import { Pricing } from "@/components/Pricing";
import { FAQ } from "@/components/FAQ";
import { InvestorDeck } from "@/components/InvestorDeck";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <VeronumDemo />
        <LatestReleases />
        <FeatureSection />
        <Pricing />
        <FAQ />
        <InvestorDeck />
      </main>
      <Footer />
    </>
  );
}
