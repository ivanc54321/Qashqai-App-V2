import { useState, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  DoorOpen,
  PackageOpen,
  Car,
  Navigation,
  Radio,
  Volume2,
  VolumeX,
  Flame,
  LocateFixed,
} from 'lucide-react';
import { CarScene, type CarHotspotState, type CameraPreset } from './components/CarScene';
import { MenuStrip, type TabKey } from './components/MenuStrip';

type Gear = 'P' | 'R' | 'N' | 'D';
type DriveMode = 'Eco' | 'Comfort' | 'Sport';

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
  const [activeTab, setActiveTab] = useState<TabKey>('navigation');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('navigation');
  const [presetTrigger, setPresetTrigger] = useState<number>(1);
  const [menuCollapsed, setMenuCollapsed] = useState<boolean>(false);

  // Tesla-style driving HUD state
  const [gear, setGear] = useState<Gear>('D');
  const [driveMode, setDriveMode] = useState<DriveMode>('Comfort');
  const [gpsSpeedMph, setGpsSpeedMph] = useState<number | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [gpsCoords, setGpsCoords] = useState<string | null>(null);

  // Bottom dock climate & audio state
  const [driverTemp, setDriverTemp] = useState<number>(21.5);
  const [passengerTemp, setPassengerTemp] = useState<number>(22.0);
  const [driverSeatHeat, setDriverSeatHeat] = useState<boolean>(false);
  const [passengerSeatHeat, setPassengerSeatHeat] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(80);
  const [radioLive, setRadioLive] = useState<boolean>(false);

  // Optional live GPS speed & location tracking
  useEffect(() => {
    if (!gpsActive || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const mps = pos.coords.speed;
        if (mps !== null && !Number.isNaN(mps)) {
          setGpsSpeedMph(Math.max(0, Math.round(mps * 2.23694)));
        }
        setGpsCoords(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`);
      },
      () => {
        setGpsActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsActive]);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setPresetTrigger((n) => n + 1);
  }, []);

  const handleSelectTab = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab);
      if (menuCollapsed) setMenuCollapsed(false);
      handleSelectCameraPreset(tab);
    },
    [menuCollapsed, handleSelectCameraPreset]
  );

  const handleToggleHotspot = useCallback((key: keyof CarHotspotState) => {
    setHotspotState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setCameraPreset(HOTSPOT_TO_PRESET[key]);
    setPresetTrigger((n) => n + 1);
  }, []);

  const handleSelectGear = (nextGear: Gear) => {
    setGear(nextGear);
    if (nextGear === 'D') {
      handleSelectCameraPreset('navigation');
    } else if (nextGear === 'R') {
      handleSelectCameraPreset('trunk');
    } else if (nextGear === 'P') {
      handleSelectCameraPreset('overview');
    }
  };

  const displayedSpeed =
    gear === 'P' || gear === 'N'
      ? 0
      : gpsSpeedMph !== null
        ? gpsSpeedMph
        : gear === 'R'
          ? 5
          : driveMode === 'Sport'
            ? 40
            : driveMode === 'Eco'
              ? 28
              : 30;

  const showLaneLines = gear === 'D' || activeTab === 'navigation';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black font-sans select-none">
      {/* Pure dark studio spotlight atmosphere */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 52% 62% at 24% 20%, rgba(186, 210, 235, 0.14) 0%, rgba(15, 23, 42, 0.22) 42%, rgba(2, 3, 5, 0.94) 78%, #000000 100%)',
        }}
      />

      {/* Full-Bleed 3D Car Stage */}
      <main className="relative z-10 h-full w-full pb-14">
        <section className="absolute inset-0 z-10">
          <CarScene
            hotspotState={hotspotState}
            onToggleHotspot={handleToggleHotspot}
            cameraPreset={cameraPreset}
            presetTrigger={presetTrigger}
            menuCollapsed={menuCollapsed}
            showLaneLines={showLaneLines}
          />
        </section>

        {/* Left Driving HUD Overlay (P R N D, Speedometer, Drive Mode) */}
        <section
          className={`pointer-events-none absolute top-0 left-0 z-20 flex flex-col items-center pt-4 px-5 transition-all duration-300 ${
            menuCollapsed ? 'w-full max-w-[360px]' : 'w-[38%] min-w-[260px]'
          }`}
        >
          {/* Top-left headlight & GPS status indicators */}
          <div className="pointer-events-auto flex w-full items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition ${
                  hotspotState.headlights
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-400'
                    : 'border-white/10 bg-white/5 text-zinc-500'
                }`}
                title="Headlights"
              >
                <Lightbulb className="h-3.5 w-3.5" />
              </span>
              <button
                type="button"
                onClick={() => setGpsActive((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition cursor-pointer ${
                  gpsActive
                    ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
                title="Toggle live device GPS speed & location"
              >
                <LocateFixed className="h-3 w-3" />
                <span>{gpsActive ? 'GPS On' : 'Use GPS'}</span>
              </button>
            </div>

            {/* P R N D Gear Selector */}
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1 backdrop-blur-md">
              {(['P', 'R', 'N', 'D'] as Gear[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleSelectGear(g)}
                  className={`h-6 w-6 rounded-full text-xs font-bold transition cursor-pointer ${
                    gear === g
                      ? 'bg-white text-black shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Large Speedometer + Drive Mode */}
          <div className="pointer-events-auto flex flex-col items-center mt-1">
            <div className="text-6xl font-light tracking-tight text-white leading-none tabular-nums">
              {displayedSpeed}
            </div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
              mph
            </div>
            <div className="mt-2.5 flex items-center gap-1 rounded-full border border-white/10 bg-black/50 p-0.5 backdrop-blur-md">
              {(['Eco', 'Comfort', 'Sport'] as DriveMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDriveMode(mode)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                    driveMode === mode
                      ? 'bg-white/15 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right Split-Screen Infotainment Panel (62% width when expanded, or compact icon dock) */}
        <section
          className={`pointer-events-none absolute top-0 bottom-14 right-0 z-20 flex flex-col justify-stretch p-3 lg:p-4 transition-all duration-300 ${
            menuCollapsed ? 'w-auto justify-center' : 'w-[62%] max-w-[820px]'
          }`}
        >
          <div className="pointer-events-auto h-full max-h-full overflow-y-auto">
            <MenuStrip
              activeTab={activeTab}
              onSelectTab={handleSelectTab}
              hotspotState={hotspotState}
              onToggleHotspot={handleToggleHotspot}
              isCollapsed={menuCollapsed}
              onToggleCollapse={() => setMenuCollapsed((c) => !c)}
              volume={volume}
              onChangeVolume={setVolume}
              onRadioLiveChange={setRadioLive}
              gpsCoords={gpsActive ? gpsCoords : null}
            />
          </div>
        </section>
      </main>

      {/* Bottom Tesla-Style Infotainment Dock Bar */}
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-between border-t border-white/10 bg-black/85 px-4 backdrop-blur-xl text-zinc-200">
        {/* Driver Climate */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDriverTemp((t) => Math.max(16, Number((t - 0.5).toFixed(1))))}
              className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              aria-label="Decrease driver temperature"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-11 text-center text-sm font-semibold tabular-nums text-white">
              {driverTemp.toFixed(1)}°
            </span>
            <button
              type="button"
              onClick={() => setDriverTemp((t) => Math.min(28, Number((t + 0.5).toFixed(1))))}
              className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              aria-label="Increase driver temperature"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDriverSeatHeat((s) => !s)}
            className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer ${
              driverSeatHeat ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-400 hover:text-white'
            }`}
            title="Driver Heated Seat"
          >
            <Flame className="h-4 w-4" />
          </button>
        </div>

        {/* Center Quick Car & App Dock */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={() => handleToggleHotspot('headlights')}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition cursor-pointer ${
              hotspotState.headlights ? 'bg-white/15 text-white' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Lights"
            aria-label="Dock Lights"
          >
            <Lightbulb className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleHotspot('doorsOpen')}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition cursor-pointer ${
              hotspotState.doorsOpen ? 'bg-white/15 text-white' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Doors"
            aria-label="Dock Doors"
          >
            <DoorOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleHotspot('trunkOpen')}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition cursor-pointer ${
              hotspotState.trunkOpen ? 'bg-white/15 text-white' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Trunk"
            aria-label="Dock Trunk"
          >
            <PackageOpen className="h-4 w-4" />
          </button>

          <div className="h-5 w-px bg-white/10 mx-1" />

          <button
            type="button"
            onClick={() => handleSelectTab('overview')}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition cursor-pointer ${
              activeTab === 'overview' && !menuCollapsed
                ? 'bg-white text-black'
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Vehicle Overview"
            aria-label="Dock Overview"
          >
            <Car className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('navigation')}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition cursor-pointer ${
              activeTab === 'navigation' && !menuCollapsed
                ? 'bg-white text-black'
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Navigation"
            aria-label="Dock Navigation"
          >
            <Navigation className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('media')}
            className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition cursor-pointer ${
              activeTab === 'media' && !menuCollapsed
                ? 'bg-white text-black'
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Media & KISS FM"
            aria-label="Dock Media"
          >
            <Radio className="h-4 w-4" />
            {radioLive && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          <div className="hidden md:flex items-center gap-1 ml-1 pl-2 border-l border-white/10">
            <button
              type="button"
              onClick={() => setVolume((v) => Math.max(0, v - 10))}
              className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              aria-label="Volume down"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVolume((v) => (v === 0 ? 75 : 0))}
              className="p-1 text-zinc-200 hover:text-white transition cursor-pointer"
              aria-label="Mute toggle"
            >
              {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setVolume((v) => Math.min(100, v + 10))}
              className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              aria-label="Volume up"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Passenger Climate */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPassengerSeatHeat((s) => !s)}
            className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer ${
              passengerSeatHeat ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-400 hover:text-white'
            }`}
            title="Passenger Heated Seat"
          >
            <Flame className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPassengerTemp((t) => Math.max(16, Number((t - 0.5).toFixed(1))))}
              className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              aria-label="Decrease passenger temperature"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-11 text-center text-sm font-semibold tabular-nums text-white">
              {passengerTemp.toFixed(1)}°
            </span>
            <button
              type="button"
              onClick={() => setPassengerTemp((t) => Math.min(28, Number((t + 0.5).toFixed(1))))}
              className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              aria-label="Increase passenger temperature"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
