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
        <source src="./background.mp4" type="video/mp4" />
      </video>

      {/* Dark studio spotlight atmosphere matching reference image */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 65% at 32% 18%, rgba(203, 213, 225, 0.16) 0%, rgba(15, 23, 42, 0.25) 42%, rgba(0, 0, 0, 0.88) 78%, rgba(0, 0, 0, 0.96) 100%)',
        }}
      />

      {/* Full-Bleed 3D Car Stage */}
      <main className="relative z-10 h-full w-full">
        <section className="absolute inset-0 z-10">
          <CarScene hotspotState={hotspotState} onToggleHotspot={handleToggleHotspot} />
        </section>

        {/* Right-Hand Floating Menu Overlay */}
        <section className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-full max-w-[400px] flex-col justify-center p-4 lg:p-6">
          <div className="pointer-events-auto max-h-full overflow-y-auto">
            <MenuStrip hotspotState={hotspotState} onToggleHotspot={handleToggleHotspot} />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
