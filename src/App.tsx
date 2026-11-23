import { useState, useCallback } from 'react';
import { CarScene, type CarHotspotState } from './components/CarScene';
import { MenuStrip } from './components/MenuStrip';

export function App() {
  const [hotspotState, setHotspotState] = useState<CarHotspotState>({
    headlights: true,
    doorsOpen: false,
    trunkOpen: false,
  });

  const handleToggleHotspot = useCallback((key: keyof CarHotspotState) => {
    setHotspotState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Full-bleed 4K Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>

      {/* Subtle dark vignette overlay for contrast */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-r from-slate-950/35 via-slate-950/20 to-slate-950/65" />

      {/* Main 60/40 Split Layout */}
      <main className="relative z-10 flex h-full w-full flex-col lg:flex-row">
        {/* Left ~60% Stage: Rotating 3D Car */}
        <section className="h-[50vh] w-full lg:h-full lg:w-[60%]">
          <CarScene hotspotState={hotspotState} onToggleHotspot={handleToggleHotspot} />
        </section>

        {/* Right ~40% Menu Strip Dashboard */}
        <section className="h-[50vh] w-full lg:h-full lg:w-[40%] border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-950/25 backdrop-blur-sm">
          <MenuStrip hotspotState={hotspotState} onToggleHotspot={handleToggleHotspot} />
        </section>
      </main>
    </div>
  );
}

export default App;
