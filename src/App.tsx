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
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-r from-slate-950/25 via-slate-950/15 to-slate-950/55" />

      {/* Full-Bleed 3D Car Stage */}
      <main className="relative z-10 h-full w-full">
        <section className="absolute inset-0 z-10">
          <CarScene hotspotState={hotspotState} onToggleHotspot={handleToggleHotspot} />
        </section>

        {/* Right-Hand Floating Menu Overlay */}
        <section className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-full max-w-[420px] flex-col justify-center p-4 lg:p-6">
          <div className="pointer-events-auto max-h-full overflow-y-auto">
            <MenuStrip hotspotState={hotspotState} onToggleHotspot={handleToggleHotspot} />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
