import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import Features from "@/components/Features";
import Product from "@/components/Product";
import Modules from "@/components/Modules";
import Security from "@/components/Security";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Features />
        <Product />
        <Modules />
        <Security />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
