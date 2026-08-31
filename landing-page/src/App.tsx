import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { Hero } from './components/sections/Hero';
import { Features } from './components/sections/Features';
import { Demo } from './components/sections/Demo';
import { Architecture } from './components/sections/Architecture';
import { TechStack } from './components/sections/TechStack';
import { UseCases } from './components/sections/UseCases';
import { CallToAction } from './components/sections/CallToAction';

function App() {
  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Demo />
        <Architecture />
        <TechStack />
        <UseCases />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}

export default App;
