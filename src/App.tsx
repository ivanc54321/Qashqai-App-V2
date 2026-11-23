import { useState, useCallback } from 'react';
import { CarScene, type CarHotspotState, type CameraPreset } from './components/CarScene';
import { MenuStrip } from './components/MenuStrip';

const HOTSPOT_TO_PRESET: Record<keyof CarHotspotState, CameraPreset> = {
  headlights: 'lights',
  doorsOpen: 'doors',
  trunkOpen: 'trunk',
};

export function App() {
  const [hotspotState, setHotspotState] = useState<CarHotspotState>({
    headlights: true,
    doorsOpen: false,
    trunkOpen: false,
  });
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [presetTrigger, setPresetTrigger] = useState<number>(0);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setPresetTrigger((n) => n + 1);
  }, []);

  const handleToggleHotspot = useCallback((key: keyof CarHotspotState) => {
    setHotspotState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setCameraPreset(HOTSPOT_TO_PRESET[key]);
    setPresetTrigger((n) => n + 1);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black font-sans select-none">
      {/* Pure dark studio spotlight atmosphere (no background video car) */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 52% 62% at 32% 16%, rgba(186, 210, 235, 0.16) 0%, rgba(15, 23, 42, 0.22) 42%, rgba(2, 3, 5, 0.92) 78%, #000000 100%)',
        }}
      />

      {/* Full-Bleed 3D Car Stage */}
      <main className="relative z-10 h-full w-full">
        <section className="absolute inset-0 z-10">
          <CarScene
            hotspotState={hotspotState}
            onToggleHotspot={handleToggleHotspot}
            cameraPreset={cameraPreset}
            presetTrigger={presetTrigger}
          />
        </section>

        {/* Right-Hand Floating Menu Overlay */}
        <section className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-full max-w-[400px] flex-col justify-center p-4 lg:p-6">
          <div className="pointer-events-auto max-h-full overflow-y-auto">
            <MenuStrip
              hotspotState={hotspotState}
              onToggleHotspot={handleToggleHotspot}
              onSelectCameraPreset={handleSelectCameraPreset}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
