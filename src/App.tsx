import { useState, useCallback, useEffect, useRef } from 'react';
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
  Moon,
  Sun,
  Camera,
  Play,
  Pause,
  ParkingSquare,
} from 'lucide-react';
import { CarScene, type CarHotspotState, type CameraPreset } from './components/CarScene';
import { MenuStrip, type TabKey } from './components/MenuStrip';
import {
  KENT_FALLBACK_CAMERAS,
  fetchNearbySpeedCameras,
  haversineMeters,
  playSpeedCameraChime,
  type SpeedCamera,
} from './utils/speedCameras';

type Gear = 'P' | 'R' | 'N' | 'D';
type DriveMode = 'Eco' | 'Comfort' | 'Sport';

export interface ParkedPin {
  coords: string;
  savedAt: string;
}

const HOTSPOT_TO_PRESET: Record<keyof CarHotspotState, CameraPreset> = {
  headlights: 'lights',
  doorsOpen: 'doors',
  trunkOpen: 'trunk',
};

const WESTWOOD_CROSS_LAT = 51.3563;
const WESTWOOD_CROSS_LON = 1.3917;

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
  const [nightDim, setNightDim] = useState<boolean>(false);

  // Speed Camera Radar state
  const [cameras, setCameras] = useState<SpeedCamera[]>(KENT_FALLBACK_CAMERAS);
  const [nearestCamera, setNearestCamera] = useState<{ camera: SpeedCamera; meters: number } | null>(
    null
  );
  const lastChimedCamRef = useRef<string | null>(null);

  // Reverse Camera feed ref
  const reverseVideoRef = useRef<HTMLVideoElement | null>(null);
  const [reverseCamActive, setReverseCamActive] = useState<boolean>(false);
  const [reverseCamError, setReverseCamError] = useState<string | null>(null);

  // Where Did I Park auto-pin
  const [parkedPin, setParkedPin] = useState<ParkedPin | null>(() => {
    try {
      const raw = localStorage.getItem('qashqai_parked_pin');
      return raw ? (JSON.parse(raw) as ParkedPin) : null;
    } catch {
      return null;
    }
  });

  // Bottom dock climate & audio state
  const [driverTemp, setDriverTemp] = useState<number>(21.5);
  const [passengerTemp, setPassengerTemp] = useState<number>(22.0);
  const [driverSeatHeat, setDriverSeatHeat] = useState<boolean>(false);
  const [passengerSeatHeat, setPassengerSeatHeat] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(80);
  const [radioLive, setRadioLive] = useState<boolean>(false);
  const [nowPlayingLabel, setNowPlayingLabel] = useState<string>('KISS FM');
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const toggleMiniPlayRef = useRef<(() => void) | null>(null);
  const jumpToParkedRef = useRef<((coords: string) => void) | null>(null);

  // Screen Wake Lock so tablet doesn't sleep while driving
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          sentinel = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Wake lock not permitted or unsupported
      }
    };
    requestWakeLock();
    const onVis = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      sentinel?.release().catch(() => {});
    };
  }, []);

  // Fetch nearby UK speed cameras around Westwood Cross or live GPS
  useEffect(() => {
    const lat = gpsCoords ? parseFloat(gpsCoords.split(',')[0]) : WESTWOOD_CROSS_LAT;
    const lon = gpsCoords ? parseFloat(gpsCoords.split(',')[1]) : WESTWOOD_CROSS_LON;
    fetchNearbySpeedCameras(lat, lon).then((list) => {
      setCameras(list);
    });
  }, [gpsCoords]);

  // Compute nearest speed camera & chime when approaching (< 450m)
  useEffect(() => {
    const lat = gpsCoords ? parseFloat(gpsCoords.split(',')[0]) : WESTWOOD_CROSS_LAT;
    const lon = gpsCoords ? parseFloat(gpsCoords.split(',')[1]) : WESTWOOD_CROSS_LON;
    if (cameras.length === 0) return;

    let best: { camera: SpeedCamera; meters: number } | null = null;
    for (const cam of cameras) {
      const m = haversineMeters(lat, lon, cam.lat, cam.lon);
      if (!best || m < best.meters) best = { camera: cam, meters: m };
    }
    setNearestCamera(best);

    if (best && best.meters <= 450 && gear === 'D' && lastChimedCamRef.current !== best.camera.id) {
      lastChimedCamRef.current = best.camera.id;
      playSpeedCameraChime();
    }
  }, [cameras, gpsCoords, gear]);

  // Live GPS speed & location tracking
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

  // Reverse camera stream management when gear === 'R'
  useEffect(() => {
    if (gear !== 'R' || !reverseCamActive) {
      const video = reverseVideoRef.current;
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setReverseCamError(null);
        if (reverseVideoRef.current) {
          reverseVideoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReverseCamError('No reverse/USB camera detected');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gear, reverseCamActive]);

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

  const saveParkedLocation = useCallback(() => {
    const coords = gpsCoords || `${WESTWOOD_CROSS_LAT},${WESTWOOD_CROSS_LON}`;
    const pin: ParkedPin = {
      coords,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setParkedPin(pin);
    try {
      localStorage.setItem('qashqai_parked_pin', JSON.stringify(pin));
    } catch {
      // Ignore storage quota errors
    }
  }, [gpsCoords]);

  const handleSelectGear = (nextGear: Gear) => {
    setGear(nextGear);
    if (nextGear === 'D') {
      setReverseCamActive(false);
      handleSelectCameraPreset('navigation');
    } else if (nextGear === 'R') {
      handleSelectCameraPreset('trunk');
    } else if (nextGear === 'P') {
      setReverseCamActive(false);
      saveParkedLocation();
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

  const activeCameraLimit = nearestCamera?.camera.maxspeed ?? 30;
  const isOverSpeed = gear === 'D' && displayedSpeed > activeCameraLimit;
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

        {/* Left Driving HUD Overlay (P R N D, Speedometer, Drive Mode, Speed Camera Radar & Reverse Assist) */}
        <section
          className={`pointer-events-none absolute top-0 left-0 z-20 flex flex-col items-center pt-4 px-5 transition-all duration-300 ${
            menuCollapsed ? 'w-full max-w-[360px]' : 'w-[38%] min-w-[260px]'
          }`}
        >
          {/* Top-left headlight, GPS, & Night Dim indicators */}
          <div className="pointer-events-auto flex w-full items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
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
              <button
                type="button"
                onClick={() => setNightDim((d) => !d)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                  nightDim
                    ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-300'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
                title="Toggle Night Dimmer"
                aria-label="Toggle Night Dimmer"
              >
                {nightDim ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
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
            <div
              className={`text-6xl font-light tracking-tight leading-none tabular-nums transition ${
                isOverSpeed ? 'text-red-400' : 'text-white'
              }`}
            >
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

          {/* Speed Camera Proximity Alert Pill */}
          {nearestCamera && gear === 'D' && (
            <div
              className={`pointer-events-auto mt-3 flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-[11px] backdrop-blur-xl shadow-lg transition ${
                isOverSpeed
                  ? 'border-red-500/60 bg-red-950/75 text-red-100 animate-pulse'
                  : 'border-amber-400/30 bg-black/70 text-zinc-200'
              }`}
            >
              <Camera className={`h-3.5 w-3.5 shrink-0 ${isOverSpeed ? 'text-red-400' : 'text-amber-400'}`} />
              <span className="truncate max-w-[160px] font-medium">
                {nearestCamera.camera.name}
              </span>
              <span className="font-mono text-[10px] text-zinc-300">
                {nearestCamera.meters < 1000
                  ? `${Math.round(nearestCamera.meters)}m`
                  : `${(nearestCamera.meters / 1609.34).toFixed(1)}mi`}
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-500 bg-white text-[9px] font-black text-zinc-950">
                {activeCameraLimit}
              </span>
            </div>
          )}

          {/* Parked Car Pin Quick Chip when in P */}
          {gear === 'P' && parkedPin && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('navigation');
                if (menuCollapsed) setMenuCollapsed(false);
                jumpToParkedRef.current?.(parkedPin.coords);
              }}
              className="pointer-events-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-950/60 px-3 py-1 text-[11px] font-medium text-emerald-200 backdrop-blur-md hover:bg-emerald-900/70 transition cursor-pointer"
            >
              <ParkingSquare className="h-3.5 w-3.5 text-emerald-400" />
              <span>Parked @ {parkedPin.savedAt} • View Pin</span>
            </button>
          )}

          {/* Reverse Assist / Live Camera Overlay when in R */}
          {gear === 'R' && (
            <div className="pointer-events-auto mt-3 w-full max-w-[290px] overflow-hidden rounded-2xl border border-amber-400/40 bg-black/85 p-2.5 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Reverse Assist
                </span>
                <button
                  type="button"
                  onClick={() => setReverseCamActive((v) => !v)}
                  className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/20 transition cursor-pointer"
                >
                  {reverseCamActive ? 'Stop Cam' : 'Live Cam'}
                </button>
              </div>
              {reverseCamActive ? (
                reverseCamError ? (
                  <div className="py-4 text-center text-[11px] text-zinc-400">{reverseCamError}</div>
                ) : (
                  <div className="relative overflow-hidden rounded-xl bg-black">
                    <video
                      ref={reverseVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-28 w-full object-cover"
                    />
                    <svg viewBox="0 0 200 80" className="pointer-events-none absolute inset-0 h-full w-full">
                      <path d="M 35 78 L 65 20" stroke="#facc15" strokeWidth="2.5" fill="none" opacity="0.8" />
                      <path d="M 165 78 L 135 20" stroke="#facc15" strokeWidth="2.5" fill="none" opacity="0.8" />
                      <path d="M 65 20 L 135 20" stroke="#ef4444" strokeWidth="2" strokeDasharray="5 4" fill="none" />
                    </svg>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center py-2">
                  <svg viewBox="0 0 180 48" className="h-10 w-40">
                    <path d="M 30 10 Q 90 38 150 10" stroke="#22c55e" strokeWidth="3" fill="none" opacity="0.7" />
                    <path d="M 48 18 Q 90 36 132 18" stroke="#facc15" strokeWidth="3" fill="none" opacity="0.85" />
                    <path d="M 66 26 Q 90 36 114 26" stroke="#ef4444" strokeWidth="3" fill="none" />
                  </svg>
                  <span className="text-[10px] text-zinc-400">Rear Ultrasonic Arcs Active</span>
                </div>
              )}
            </div>
          )}
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
              onMediaStateChange={(label, playing) => {
                setNowPlayingLabel(label);
                setIsAudioPlaying(playing);
              }}
              onRegisterMiniPlayToggle={(fn) => {
                toggleMiniPlayRef.current = fn;
              }}
              onRegisterJumpToCoords={(fn) => {
                jumpToParkedRef.current = fn;
              }}
              gpsCoords={gpsActive ? gpsCoords : null}
              isOverSpeed={isOverSpeed}
              nearestCamera={nearestCamera}
              speedLimit={activeCameraLimit}
              parkedPin={parkedPin}
              onSaveParkedPin={saveParkedLocation}
            />
          </div>
        </section>
      </main>

      {/* Auto Night Dimmer Overlay */}
      {nightDim && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-black/40 transition-opacity duration-300" />
      )}

      {/* Bottom Tesla-Style Infotainment Dock Bar */}
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-between border-t border-white/10 bg-black/85 px-3 sm:px-4 backdrop-blur-xl text-zinc-200">
        {/* Driver Climate */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
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

        {/* Center Quick Car, Tabs & Persistent Mini Media Player */}
        <div className="flex items-center gap-1 sm:gap-2">
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

          <div className="h-5 w-px bg-white/10 mx-0.5" />

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
            title="Media & Radio"
            aria-label="Dock Media"
          >
            <Radio className="h-4 w-4" />
            {radioLive && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          {/* Persistent Mini Media Bar */}
          <div className="hidden lg:flex items-center gap-2 ml-1 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1">
            <button
              type="button"
              onClick={() => toggleMiniPlayRef.current?.()}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black hover:scale-105 transition cursor-pointer"
              aria-label="Mini player play or pause"
            >
              {isAudioPlaying ? (
                <Pause className="h-3 w-3 fill-current" />
              ) : (
                <Play className="h-3 w-3 fill-current ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('media')}
              className="max-w-[96px] truncate text-[11px] font-medium text-zinc-200 hover:text-white cursor-pointer"
            >
              {nowPlayingLabel}
            </button>
          </div>

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
        <div className="flex items-center gap-1.5">
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
          <div className="flex items-center gap-0.5">
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
