import { useEffect } from "react";
import Nav from "./Nav";
import Hero from "./Hero";
import Marquee from "./Marquee";
import ProblemSolution from "./ProblemSolution";
import HowItWorks from "./HowItWorks";
import Calculator from "./Calculator";
import Marketplace from "./Marketplace";
import LordFarmsDeal from "./LordFarmsDeal";
import Invest from "./Invest";
import Integrations from "./Integrations";
import Security from "./Security";
import FAQ from "./FAQ";
import Footer from "./Footer";

export default function App() {
  useEffect(() => {
    document.title = "Secured Landing — Secure, Fast, Reliable";
  }, []);

  return (
    <div className="grain min-h-screen bg-ink-950 text-paper-50">
      <Nav />

      <div className="bg-gradient-to-r from-moss-600 to-ink-800 text-white text-center py-3">
        <p className="max-w-4xl mx-auto px-4">
          Land-backed lending up to 50% LTV. Invest from $100 and earn 9% fixed interest.
        </p>
      </div>

      <main>
        <Hero />
        <Marquee />
        <ProblemSolution />
        <HowItWorks />
        <Calculator />
        <Marketplace />
        <LordFarmsDeal />
        <Invest />
        <Integrations />
        <Security />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
