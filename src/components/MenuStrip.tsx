import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Car,
  Navigation,
  MapPin,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Lightbulb,
  DoorOpen,
  PackageOpen,
  Fuel,
  Search,
  ShieldCheck,
  AlertTriangle,
  Gauge,
  Thermometer,
  Radio,
  Music,
  Film,
  FolderOpen,
  Maximize2,
  X,
  Trash2,
  Loader2,
  ExternalLink,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  ArrowUp,
  Wifi,
  Bluetooth,
  Wrench,
  CheckCircle2,
  Camera,
  ParkingSquare,
  BatteryCharging,
  Activity,
} from 'lucide-react';
import type { CarHotspotState, LayoutMode } from './CarScene';
import type { ParkedPin } from '../App';
import {
  RADIO_STATIONS,
  DESTINATIONS,
  DEFAULT_MAINTENANCE_ITEMS,
  QASHQAI_GLOVEBOX_SPECS,
  type RadioStation,
  type MaintenanceItem,
} from '../data/qashqaiData';
import type { SpeedCamera } from '../utils/speedCameras';
import { loadMediaRecords, saveMediaRecords, deleteMediaRecord } from '../utils/mediaStore';

export type TabKey = 'overview' | 'navigation' | 'media';

interface MenuStripProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  hotspotState: CarHotspotState;
  onToggleHotspot: (key: keyof CarHotspotState) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  volume: number;
  onChangeVolume: (vol: number) => void;
  onRadioLiveChange: (live: boolean) => void;
  onMediaStateChange: (label: string, playing: boolean) => void;
  onRegisterMiniPlayToggle: (fn: () => void) => void;
  onRegisterJumpToCoords: (fn: (coords: string) => void) => void;
  gpsCoords: string | null;
  isOverSpeed: boolean;
  nearestCamera: { camera: SpeedCamera; meters: number } | null;
  speedLimit: number;
  parkedPin: ParkedPin | null;
  onSaveParkedPin: () => void;
  layoutMode?: LayoutMode;
}

type MediaMode = 'radio' | 'music' | 'videos';
type ActiveAudioSource = 'none' | 'radio' | 'local-music';
type RadioStatus = 'idle' | 'loading' | 'playing' | 'error';

interface LocalMediaItem {
  id: string;
  name: string;
  url: string;
  sizeLabel: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const stripExtension = (filename: string) => filename.replace(/\.[^/.]+$/, '');

export const MenuStrip: React.FC<MenuStripProps> = ({
  activeTab,
  onSelectTab,
  hotspotState,
  onToggleHotspot,
  isCollapsed,
  onToggleCollapse,
  volume,
  onChangeVolume,
  onRadioLiveChange,
  onMediaStateChange,
  onRegisterMiniPlayToggle,
  onRegisterJumpToCoords,
  gpsCoords,
  isOverSpeed,
  nearestCamera,
  speedLimit,
  parkedPin,
  onSaveParkedPin,
  layoutMode = 'horizontal-tablet',
}) => {
  const isCompact = layoutMode !== 'horizontal-tablet';
  const [mediaMode, setMediaMode] = useState<MediaMode>('radio');
  const [timeStr, setTimeStr] = useState('');
  const [activeDest, setActiveDest] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapQuery, setMapQuery] = useState(DESTINATIONS[0].query);
  const [mapLabel, setMapLabel] = useState(DESTINATIONS[0].name);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Radio state
  const [activeStation, setActiveStation] = useState<RadioStation>(RADIO_STATIONS[0]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const streamIdxRef = useRef(0);
  const activeStationRef = useRef<RadioStation>(RADIO_STATIONS[0]);
  const activeSourceRef = useRef<ActiveAudioSource>('none');
  const createdUrlsRef = useRef<string[]>([]);

  const [activeAudioSource, setActiveAudioSource] = useState<ActiveAudioSource>('none');
  const [radioStatus, setRadioStatus] = useState<RadioStatus>('idle');

  // Local Music & Video state (persisted via IndexedDB)
  const [localTracks, setLocalTracks] = useState<LocalMediaItem[]>([]);
  const [localTrackIndex, setLocalTrackIndex] = useState(0);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const [localVideos, setLocalVideos] = useState<LocalMediaItem[]>([]);
  const [localVideoIndex, setLocalVideoIndex] = useState(0);
  const [videoFullscreen, setVideoFullscreen] = useState(false);

  // Qashqai Maintenance Log (persisted in localStorage)
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>(() => {
    try {
      const raw = localStorage.getItem('qashqai_maintenance_log');
      return raw ? (JSON.parse(raw) as MaintenanceItem[]) : DEFAULT_MAINTENANCE_ITEMS;
    } catch {
      return DEFAULT_MAINTENANCE_ITEMS;
    }
  });

  // OBD-II Bluetooth / Live Telemetry State
  const [obdStatus, setObdStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'demo'>(
    'demo'
  );
  const [obdData, setObdData] = useState({
    rpm: 820,
    coolantC: 89,
    boostBar: 0.2,
    batteryV: 14.1,
    dpfSootPct: 34,
  });

  useEffect(() => {
    activeStationRef.current = activeStation;
  }, [activeStation]);

  useEffect(() => {
    activeSourceRef.current = activeAudioSource;
    const isRadioPlaying = activeAudioSource === 'radio' && radioStatus === 'playing';
    onRadioLiveChange(isRadioPlaying);
    if (activeAudioSource === 'radio') {
      onMediaStateChange(activeStation.name, isRadioPlaying || radioStatus === 'loading');
    } else if (activeAudioSource === 'local-music' && localTracks[localTrackIndex]) {
      onMediaStateChange(localTracks[localTrackIndex].name, localPlaying);
    } else {
      onMediaStateChange(activeStation.name, false);
    }
  }, [
    activeAudioSource,
    radioStatus,
    activeStation.name,
    localPlaying,
    localTracks,
    localTrackIndex,
    onRadioLiveChange,
    onMediaStateChange,
  ]);

  // Subtle realistic telemetry pulse in demo mode
  useEffect(() => {
    if (obdStatus !== 'demo') return;
    const id = setInterval(() => {
      setObdData((prev) => ({
        rpm: 780 + Math.round(Math.random() * 80),
        coolantC: 89 + (Math.random() > 0.7 ? 1 : 0),
        boostBar: Number((0.15 + Math.random() * 0.15).toFixed(2)),
        batteryV: Number((14.0 + Math.random() * 0.2).toFixed(1)),
        dpfSootPct: prev.dpfSootPct,
      }));
    }, 2500);
    return () => clearInterval(id);
  }, [obdStatus]);

  // Load persisted local music & videos from IndexedDB on startup
  useEffect(() => {
    let mounted = true;
    loadMediaRecords().then((records) => {
      if (!mounted || records.length === 0) return;
      const music: LocalMediaItem[] = [];
      const videos: LocalMediaItem[] = [];
      records.forEach((rec) => {
        const url = URL.createObjectURL(rec.blob);
        createdUrlsRef.current.push(url);
        const item = { id: rec.id, name: rec.name, url, sizeLabel: rec.sizeLabel };
        if (rec.kind === 'music') music.push(item);
        else videos.push(item);
      });
      if (music.length > 0) setLocalTracks(music);
      if (videos.length > 0) setLocalVideos(videos);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const id = setInterval(updateTime, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const v = Math.min(1, Math.max(0, volume / 100));
    if (audioRef.current) audioRef.current.volume = v;
    if (videoRef.current) videoRef.current.volume = v;
  }, [volume]);

  useEffect(() => {
    const urls = createdUrlsRef.current;
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setActiveAudioSource('none');
    setRadioStatus('idle');
    setLocalPlaying(false);
  }, []);

  const startStationStreamAt = useCallback(
    (station: RadioStation, initialIdx: number) => {
      const tryStream = (idx: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        streamIdxRef.current = idx;
        audio.src = station.streams[idx];
        audio.volume = volume / 100;
        audio.play().catch(() => {
          if (activeSourceRef.current !== 'radio') return;
          if (idx + 1 < station.streams.length) {
            tryStream(idx + 1);
          } else {
            setRadioStatus('error');
          }
        });
      };
      tryStream(initialIdx);
    },
    [volume]
  );

  const handleToggleStation = useCallback(
    (station: RadioStation) => {
      const isSameStationActive =
        activeStation.id === station.id &&
        activeAudioSource === 'radio' &&
        (radioStatus === 'playing' || radioStatus === 'loading');

      if (isSameStationActive) {
        stopAudio();
        return;
      }
      if (videoRef.current) videoRef.current.pause();
      setLocalPlaying(false);
      setActiveStation(station);
      activeStationRef.current = station;
      setActiveAudioSource('radio');
      activeSourceRef.current = 'radio';
      setRadioStatus('loading');
      startStationStreamAt(station, 0);
    },
    [activeStation.id, activeAudioSource, radioStatus, stopAudio, startStationStreamAt]
  );

  const playLocalTrack = useCallback(
    (index: number, tracksList: LocalMediaItem[] = localTracks) => {
      const track = tracksList[index];
      const audio = audioRef.current;
      if (!track || !audio) return;
      if (videoRef.current) videoRef.current.pause();
      setRadioStatus('idle');
      setActiveAudioSource('local-music');
      activeSourceRef.current = 'local-music';
      setLocalTrackIndex(index);
      setAudioCurrentTime(0);
      setAudioDuration(0);
      audio.src = track.url;
      audio.volume = volume / 100;
      audio.play().catch(() => setLocalPlaying(false));
    },
    [localTracks, volume]
  );

  const handleToggleLocalMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || localTracks.length === 0) return;
    if (activeAudioSource !== 'local-music') {
      playLocalTrack(localTrackIndex);
      return;
    }
    if (audio.paused) {
      if (videoRef.current) videoRef.current.pause();
      audio.play().catch(() => setLocalPlaying(false));
    } else {
      audio.pause();
    }
  }, [audioRef, localTracks.length, activeAudioSource, localTrackIndex, playLocalTrack]);

  // Register bottom dock mini-player toggle & parked-pin map jump
  useEffect(() => {
    onRegisterMiniPlayToggle(() => {
      if (activeAudioSource === 'local-music' && localTracks.length > 0) {
        handleToggleLocalMusic();
      } else {
        handleToggleStation(activeStation);
      }
    });
  }, [
    onRegisterMiniPlayToggle,
    activeAudioSource,
    localTracks.length,
    handleToggleLocalMusic,
    handleToggleStation,
    activeStation,
  ]);

  useEffect(() => {
    onRegisterJumpToCoords((coords: string) => {
      setMapQuery(coords);
      setMapLabel('Parked Qashqai');
    });
  }, [onRegisterJumpToCoords]);

  const handleConnectObd = async () => {
    const navBt = (navigator as unknown as { bluetooth?: { requestDevice: (opts: unknown) => Promise<unknown> } }).bluetooth;
    if (!navBt) {
      setObdStatus('demo');
      return;
    }
    try {
      setObdStatus('connecting');
      await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb'],
      });
      setObdStatus('connected');
    } catch {
      setObdStatus('demo');
    }
  };

  const handleMarkMaintenanceDone = (id: string) => {
    const today = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const updated: MaintenanceItem[] = maintenance.map((m) =>
      m.id === id ? { ...m, status: 'ok', dueLabel: `Done ${today}` } : m
    );
    setMaintenance(updated);
    try {
      localStorage.setItem('qashqai_maintenance_log', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleNextTrack = () => {
    if (localTracks.length === 0) return;
    playLocalTrack((localTrackIndex + 1) % localTracks.length);
  };

  const handlePrevTrack = () => {
    if (localTracks.length === 0) return;
    playLocalTrack((localTrackIndex - 1 + localTracks.length) % localTracks.length);
  };

  const handleAddMusicFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nowTs = Date.now();
    const records = files.map((file, i) => ({
      id: `music-${file.name}-${file.size}-${nowTs}-${i}`,
      kind: 'music' as const,
      name: stripExtension(file.name),
      sizeLabel: formatFileSize(file.size),
      blob: file,
      addedAt: nowTs + i,
    }));
    const newItems: LocalMediaItem[] = records.map((r) => {
      const url = URL.createObjectURL(r.blob);
      createdUrlsRef.current.push(url);
      return { id: r.id, name: r.name, url, sizeLabel: r.sizeLabel };
    });
    const updated = [...localTracks, ...newItems];
    setLocalTracks(updated);
    setMediaMode('music');
    await saveMediaRecords(records);
    if (activeAudioSource !== 'local-music') {
      playLocalTrack(localTracks.length, updated);
    }
    e.target.value = '';
  };

  const handleRemoveMusicTrack = async (id: string, idx: number) => {
    const target = localTracks[idx];
    if (target) URL.revokeObjectURL(target.url);
    const updated = localTracks.filter((t) => t.id !== id);
    setLocalTracks(updated);
    await deleteMediaRecord(id);
    if (updated.length === 0) {
      if (activeAudioSource === 'local-music') stopAudio();
      setLocalTrackIndex(0);
    } else if (idx === localTrackIndex) {
      const nextIdx = Math.min(idx, updated.length - 1);
      setLocalTrackIndex(nextIdx);
      if (activeAudioSource === 'local-music') playLocalTrack(nextIdx, updated);
    } else if (idx < localTrackIndex) {
      setLocalTrackIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const handleAddVideoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nowTs = Date.now();
    const records = files.map((file, i) => ({
      id: `video-${file.name}-${file.size}-${nowTs}-${i}`,
      kind: 'video' as const,
      name: stripExtension(file.name),
      sizeLabel: formatFileSize(file.size),
      blob: file,
      addedAt: nowTs + i,
    }));
    const newItems: LocalMediaItem[] = records.map((r) => {
      const url = URL.createObjectURL(r.blob);
      createdUrlsRef.current.push(url);
      return { id: r.id, name: r.name, url, sizeLabel: r.sizeLabel };
    });
    const startIdx = localVideos.length;
    setLocalVideos((prev) => [...prev, ...newItems]);
    setLocalVideoIndex(startIdx);
    setMediaMode('videos');
    await saveMediaRecords(records);
    e.target.value = '';
  };

  const handleRemoveVideo = async (id: string, idx: number) => {
    const target = localVideos[idx];
    if (target) URL.revokeObjectURL(target.url);
    const updated = localVideos.filter((v) => v.id !== id);
    setLocalVideos(updated);
    await deleteMediaRecord(id);
    if (updated.length === 0) {
      setLocalVideoIndex(0);
      setVideoFullscreen(false);
    } else if (idx <= localVideoIndex) {
      setLocalVideoIndex(
        Math.max(0, Math.min(localVideoIndex - (idx < localVideoIndex ? 1 : 0), updated.length - 1))
      );
    }
  };

  const formatTime = (sec: number) => {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const whole = Math.floor(sec);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentLocalTrack = localTracks[localTrackIndex];
  const currentLocalVideo = localVideos[localVideoIndex];

  const filteredDests = DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const motExpiry = new Date('2026-10-18T23:59:59');
  const now = new Date();
  const daysUntilMot = Math.ceil((motExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const motExpired = daysUntilMot < 0;
  const motSoon = !motExpired && daysUntilMot <= 30;

  return (
    <aside className="flex h-full w-full flex-col gap-3 text-zinc-100">
      {/* Minimized Vertical Glass Icon Dock */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-white/10 bg-black/60 p-2 backdrop-blur-xl shadow-2xl">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
            aria-label="Expand menu"
            title="Expand Menu"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>

          <div className="h-px w-7 bg-white/10 my-0.5" />

          {(
            [
              { key: 'overview', label: 'Overview', Icon: Car },
              { key: 'navigation', label: 'Navigation', Icon: Navigation },
              { key: 'media', label: 'Media', Icon: Radio },
            ] as const
          ).map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            const showLiveDot = key === 'media' && activeAudioSource === 'radio' && radioStatus === 'playing';
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectTab(key)}
                className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border transition cursor-pointer ${
                  isActive
                    ? 'border-white/30 bg-white/15 text-white'
                    : 'border-transparent bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
                aria-label={`Open ${label}`}
                title={label}
              >
                <Icon className="h-4 w-4" />
                {showLiveDot && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            );
          })}

          <div className="h-px w-7 bg-white/10 my-0.5" />

          <button
            type="button"
            onClick={() => onToggleHotspot('headlights')}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition cursor-pointer ${
              hotspotState.headlights
                ? 'border-white/35 bg-white/15 text-white'
                : 'border-transparent bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            aria-label="Toggle Lights"
            title="Lights"
          >
            <Lightbulb className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onToggleHotspot('doorsOpen')}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition cursor-pointer ${
              hotspotState.doorsOpen
                ? 'border-white/35 bg-white/15 text-white'
                : 'border-transparent bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            aria-label="Toggle Doors"
            title="Doors"
          >
            <DoorOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onToggleHotspot('trunkOpen')}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition cursor-pointer ${
              hotspotState.trunkOpen
                ? 'border-white/35 bg-white/15 text-white'
                : 'border-transparent bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            aria-label="Toggle Trunk"
            title="Trunk"
          >
            <PackageOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Full Expanded Menu */}
      <div className={isCollapsed ? 'hidden' : `flex h-full w-full flex-col ${isCompact ? 'gap-1.5' : 'gap-2.5'}`}>
        {/* Sleek Top Status Bar + Tab Switcher */}
        <div
          className={`flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/65 backdrop-blur-xl shadow-xl ${
            isCompact ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 shrink-0">
              <Fuel className="h-3.5 w-3.5" />
              76%
            </span>
            <span className="hidden lg:inline text-xs font-semibold tracking-wide text-white truncate">
              NISSAN QASHQAI
            </span>
            <span className="hidden sm:inline whitespace-nowrap shrink-0 rounded bg-[#facc15] px-1.5 py-0.5 text-[10px] font-black tracking-wider text-zinc-950">
              WG62 HJC
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
            {(
              [
                { key: 'overview', label: 'Overview' },
                { key: 'navigation', label: 'Navigation' },
                { key: 'media', label: 'Media' },
              ] as { key: TabKey; label: string }[]
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onSelectTab(tab.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-white text-black shadow-sm'
                      : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-300 shrink-0">
            <Bluetooth className="hidden md:block h-3.5 w-3.5 text-sky-400" />
            <Wifi className="hidden md:block h-3.5 w-3.5 text-zinc-300" />
            <span className="hidden sm:inline text-[11px] text-zinc-400">11°C</span>
            <span className="font-medium text-white text-xs">{timeStr || '12:16'}</span>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-zinc-300 hover:bg-white/15 hover:text-white transition cursor-pointer"
              aria-label="Minimize menu to icons"
              title="Minimize to Icons"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab 1: 2012 Qashqai J10 Tailored Overview, OBD-II, DPF & Service Log */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-2.5 overflow-y-auto pr-0.5 pb-2">
            {/* OBD-II Live Telemetry & DPF Health */}
            <div className="flex flex-col gap-2.5 rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                    J10 Diesel OBD-II & DPF
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleConnectObd}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                    obdStatus === 'connected'
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/15 bg-white/10 text-zinc-200 hover:bg-white/20'
                  }`}
                >
                  <Bluetooth className="h-3 w-3" />
                  <span>
                    {obdStatus === 'connected'
                      ? 'ELM327 Live'
                      : obdStatus === 'connecting'
                        ? 'Pairing...'
                        : 'Pair ELM327'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-xl bg-white/[0.04] p-2.5">
                  <div className="text-[10px] text-zinc-500">RPM</div>
                  <div className="text-xs font-bold text-white tabular-nums">{obdData.rpm}</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-2.5">
                  <div className="text-[10px] text-zinc-500">Coolant</div>
                  <div className="text-xs font-bold text-white tabular-nums">{obdData.coolantC}°C</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-2.5">
                  <div className="text-[10px] text-zinc-500">12V Batt</div>
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 tabular-nums">
                    <BatteryCharging className="h-3 w-3" />
                    {obdData.batteryV}V
                  </div>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-2.5">
                  <div className="text-[10px] text-zinc-500">DPF Soot</div>
                  <div
                    className={`text-xs font-bold tabular-nums ${
                      obdData.dpfSootPct > 65 ? 'text-amber-400' : 'text-sky-300'
                    }`}
                  >
                    {obdData.dpfSootPct}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Gauge className="h-3.5 w-3.5" />
                    Avg MPG
                  </span>
                  <span className="font-bold text-white">54.2 mpg</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Thermometer className="h-3.5 w-3.5" />
                    Boost
                  </span>
                  <span className="font-bold text-white">{obdData.boostBar} bar</span>
                </div>
              </div>
            </div>

            {/* MOT & Parked Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex flex-col justify-between gap-2 rounded-2xl border border-white/10 bg-black/60 p-3.5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    {motExpired ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    )}
                    MOT Status
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                      motExpired
                        ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                        : motSoon
                          ? 'bg-amber-500/15 text-amber-200 border-amber-400/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                    }`}
                  >
                    {motExpired ? 'Expired' : motSoon ? `${daysUntilMot}d left` : 'Valid'}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Valid until <span className="font-semibold text-white">18 Oct 2026</span>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-2 rounded-2xl border border-white/10 bg-black/60 p-3.5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    <ParkingSquare className="h-4 w-4 text-emerald-400" />
                    Parked Pin
                  </span>
                  <button
                    type="button"
                    onClick={onSaveParkedPin}
                    className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    Save Now
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{parkedPin ? `Saved @ ${parkedPin.savedAt}` : 'Auto-saves in P'}</span>
                  {parkedPin && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapQuery(parkedPin.coords);
                        setMapLabel('Parked Qashqai');
                        onSelectTab('navigation');
                      }}
                      className="text-sky-300 font-semibold hover:underline cursor-pointer"
                    >
                      Show on Map
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2012 Qashqai Service & Maintenance Log */}
            <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  <Wrench className="h-3.5 w-3.5 text-zinc-300" />
                  Qashqai Service Log
                </span>
                <span className="text-[10px] text-zinc-500">Tap item to mark done</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {maintenance.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMarkMaintenanceDone(item.id)}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-left hover:bg-white/10 transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white">{item.title}</div>
                      <div className="truncate text-[10px] text-zinc-400">{item.detail}</div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.status === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {item.dueLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Glovebox Quick Reference */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-xl">
              {QASHQAI_GLOVEBOX_SPECS.map((spec) => (
                <div key={spec.label} className="rounded-xl bg-white/[0.04] px-2.5 py-2">
                  <div className="text-[10px] text-zinc-500">{spec.label}</div>
                  <div className="truncate text-[11px] font-semibold text-white">{spec.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Full-Height Tesla-Style Dark Google Maps Navigation */}
        {activeTab === 'navigation' && (
          <div
            className={`relative flex-1 w-full overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 shadow-2xl ${
              isCompact ? 'min-h-[180px]' : 'min-h-[340px]'
            }`}
          >
            <iframe
              title="Google Maps Navigation"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(gpsCoords && mapLabel === 'My GPS Location' ? gpsCoords : mapQuery)}&t=${mapStyle === 'satellite' ? 'k' : ''}&z=14&ie=UTF8&iwloc=&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full border-0"
              style={
                mapStyle === 'dark'
                  ? {
                      filter:
                        'invert(92%) hue-rotate(180deg) brightness(90%) contrast(96%) saturate(70%)',
                    }
                  : {
                      filter: 'brightness(88%) contrast(106%) saturate(90%)',
                    }
              }
            />

            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 shadow-[inset_0_0_28px_rgba(0,0,0,0.6)]" />

            {/* Floating Top-Left: Blue Turn-by-Turn Card + UK Speed Limit + Camera Badge */}
            <div
              className={`absolute left-3 top-3 flex flex-col gap-2 ${
                layoutMode === 'vertical-mobile' ? 'max-w-[148px]' : 'max-w-[240px]'
              }`}
            >
              <div
                className={`flex items-center gap-2 rounded-xl bg-blue-600/95 text-white shadow-xl backdrop-blur-md ${
                  layoutMode === 'vertical-mobile' ? 'px-2.5 py-1.5' : 'px-3 py-2'
                }`}
              >
                <ArrowUp className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold leading-tight">
                    {DESTINATIONS[activeDest]?.distance ?? '2.1 mi'}
                  </div>
                  <div className="truncate text-[10px] sm:text-[11px] text-blue-100">
                    Toward {mapLabel}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-[3.5px] border-red-500 bg-white text-xs font-black text-zinc-950 shadow-lg ${
                    isOverSpeed ? 'animate-pulse ring-4 ring-red-500/50' : ''
                  }`}
                >
                  {speedLimit}
                </div>
                {nearestCamera && (
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-black/80 px-2.5 py-1 text-[10px] font-semibold text-amber-200 backdrop-blur-md shadow-lg">
                    <Camera className="h-3 w-3 text-amber-400" />
                    <span>
                      {nearestCamera.meters < 1000
                        ? `${Math.round(nearestCamera.meters)}m`
                        : `${(nearestCamera.meters / 1609.34).toFixed(1)}mi`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Top-Right: Search + Map Controls */}
            <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = searchQuery.trim();
                  if (!trimmed) return;
                  setMapQuery(trimmed);
                  setMapLabel(trimmed);
                }}
                className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/80 p-1 backdrop-blur-md shadow-xl"
              >
                <Search className="ml-1.5 h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search postcode..."
                  className={`${
                    layoutMode === 'vertical-mobile' ? 'w-24' : 'w-36 sm:w-44'
                  } bg-transparent px-1 py-1 text-xs text-white placeholder-zinc-500 outline-none`}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25 transition cursor-pointer"
                >
                  Go
                </button>
              </form>

              <div className="flex items-center gap-1.5">
                {gpsCoords && (
                  <button
                    type="button"
                    onClick={() => {
                      setMapQuery(gpsCoords);
                      setMapLabel('My GPS Location');
                    }}
                    className="rounded-lg border border-sky-400/40 bg-black/80 px-2.5 py-1 text-[10px] font-semibold text-sky-300 backdrop-blur-md hover:bg-black transition cursor-pointer"
                  >
                    My GPS
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMapStyle((s) => (s === 'dark' ? 'satellite' : 'dark'))}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/80 px-2.5 py-1 text-[10px] font-semibold text-zinc-100 backdrop-blur-md hover:bg-black transition cursor-pointer"
                  title="Switch Dark / Satellite map"
                >
                  <Layers className="h-3 w-3" />
                  <span>{mapStyle === 'dark' ? 'Dark' : 'Sat'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapFullscreen(true)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-black/80 text-white backdrop-blur-md hover:bg-black transition cursor-pointer"
                  aria-label="Expand map fullscreen"
                  title="Fullscreen Map"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Floating Bottom Route/ETA Card + Quick Kent Presets */}
            <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2">
              <div className="flex flex-col gap-1.5 rounded-2xl border border-white/15 bg-black/85 p-3 backdrop-blur-xl shadow-2xl min-w-[210px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-xs font-bold text-white">{mapLabel}</span>
                  <span className="text-xs font-semibold text-zinc-300">
                    {DESTINATIONS[activeDest]?.eta ?? 'Live'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-400">
                  <span>{DESTINATIONS[activeDest]?.distance ?? 'Route'}</span>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-black hover:bg-zinc-200 transition"
                  >
                    <span>Start GPS</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {filteredDests.map((dest) => {
                  const idx = DESTINATIONS.indexOf(dest);
                  const isSelected = mapQuery === dest.query;
                  return (
                    <button
                      key={dest.name}
                      type="button"
                      onClick={() => {
                        setActiveDest(idx);
                        setMapQuery(dest.query);
                        setMapLabel(dest.name);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition cursor-pointer ${
                        isSelected
                          ? 'border-white/40 bg-white text-black font-semibold'
                          : 'border-white/15 bg-black/75 text-zinc-200 hover:bg-black'
                      }`}
                    >
                      <MapPin className="h-3 w-3" />
                      <span>{dest.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Dark Google Maps Overlay */}
        {mapFullscreen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Navigation className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{mapLabel}</div>
                  <div className="truncate text-[11px] text-zinc-400">{mapQuery}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMapStyle((s) => (s === 'dark' ? 'satellite' : 'dark'))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{mapStyle === 'dark' ? 'Dark Mode' : 'Satellite'}</span>
                </button>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition"
                >
                  <span>Start GPS</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setMapFullscreen(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl">
              <iframe
                title="Google Maps Fullscreen"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=${mapStyle === 'satellite' ? 'k' : ''}&z=14&ie=UTF8&iwloc=&output=embed`}
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
                style={
                  mapStyle === 'dark'
                    ? {
                        filter:
                          'invert(92%) hue-rotate(180deg) brightness(90%) contrast(96%) saturate(70%)',
                      }
                    : {
                        filter: 'brightness(88%) contrast(106%) saturate(90%)',
                      }
                }
              />
            </div>
          </div>
        )}

        {/* Persistent Audio Element & Hidden File Pickers */}
        <audio
          ref={audioRef}
          preload="none"
          onPlaying={() => {
            if (activeSourceRef.current === 'radio') setRadioStatus('playing');
            if (activeSourceRef.current === 'local-music') setLocalPlaying(true);
          }}
          onWaiting={() => {
            if (activeSourceRef.current === 'radio') setRadioStatus('loading');
          }}
          onPause={() => {
            if (activeSourceRef.current === 'local-music') setLocalPlaying(false);
          }}
          onTimeUpdate={(e) => {
            if (activeSourceRef.current === 'local-music') {
              setAudioCurrentTime(e.currentTarget.currentTime);
            }
          }}
          onLoadedMetadata={(e) => {
            if (activeSourceRef.current === 'local-music') {
              const dur = e.currentTarget.duration;
              setAudioDuration(isFinite(dur) ? dur : 0);
            }
          }}
          onEnded={() => {
            if (activeSourceRef.current === 'local-music') {
              if (localTracks.length > 1) {
                playLocalTrack((localTrackIndex + 1) % localTracks.length);
              } else {
                setLocalPlaying(false);
              }
            }
          }}
          onError={() => {
            if (activeSourceRef.current === 'radio') {
              const nextIdx = streamIdxRef.current + 1;
              if (nextIdx < activeStationRef.current.streams.length) {
                startStationStreamAt(activeStationRef.current, nextIdx);
              } else {
                setRadioStatus('error');
              }
            } else if (activeSourceRef.current === 'local-music') {
              setLocalPlaying(false);
            }
          }}
        />
        <input
          ref={musicInputRef}
          type="file"
          multiple
          accept="audio/*"
          onChange={handleAddMusicFiles}
          className="hidden"
          aria-label="Select local music files"
        />
        <input
          ref={videoInputRef}
          type="file"
          multiple
          accept="video/*"
          onChange={handleAddVideoFiles}
          className="hidden"
          aria-label="Select local video files"
        />

        {/* Tab 3: Media Hub (Multi-Station UK Radio • Persistent Local Music • Local Videos) */}
        {activeTab === 'media' && (
          <div className="flex flex-col gap-3.5 rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-2xl">
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] p-1">
              {(
                [
                  { id: 'radio', label: 'Radio', Icon: Radio },
                  { id: 'music', label: 'Music', Icon: Music },
                  { id: 'videos', label: 'Videos', Icon: Film },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = mediaMode === id;
                return (
                  <button
                    key={id}
                    onClick={() => setMediaMode(id)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-white text-black shadow-sm'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* 1. UK Live Radio Presets (KISS FM + Sister & Kent Stations) */}
            {mediaMode === 'radio' && (
              <div className="flex flex-col gap-2.5">
                {/* Featured One-Click Active Station */}
                <button
                  onClick={() => handleToggleStation(activeStation)}
                  className={`group flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                    activeAudioSource === 'radio' && (radioStatus === 'playing' || radioStatus === 'loading')
                      ? 'border-pink-500/50 bg-gradient-to-r from-pink-600/25 via-fuchsia-600/15 to-black/40 shadow-lg'
                      : 'border-white/15 bg-white/[0.05] hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${activeStation.gradient} text-white font-black tracking-tight text-xs text-center whitespace-pre-line shadow-md`}
                  >
                    {activeStation.shortName}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-white">{activeStation.name}</span>
                      {activeAudioSource === 'radio' && radioStatus === 'playing' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400 border border-red-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-zinc-400">
                      {activeAudioSource === 'radio' && radioStatus === 'loading'
                        ? 'Connecting to live stream...'
                        : activeAudioSource === 'radio' && radioStatus === 'error'
                          ? 'Stream unavailable — tap to retry'
                          : activeStation.subtitle}
                    </div>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-md group-hover:scale-105 active:scale-95 transition">
                    {activeAudioSource === 'radio' && radioStatus === 'loading' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : activeAudioSource === 'radio' && radioStatus === 'playing' ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    )}
                  </div>
                </button>

                {/* 1-Tap Station Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {RADIO_STATIONS.map((station) => {
                    const isSelected = activeStation.id === station.id;
                    const isPlayingThis = isSelected && activeAudioSource === 'radio' && radioStatus === 'playing';
                    return (
                      <button
                        key={station.id}
                        type="button"
                        onClick={() => handleToggleStation(station)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition cursor-pointer ${
                          isSelected
                            ? 'border-white/35 bg-white/15 text-white font-semibold'
                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate">{station.name}</span>
                        {isPlayingThis && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Local Music Player (IndexedDB Persisted) */}
            {mediaMode === 'music' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">
                    Saved Music ({localTracks.length})
                  </span>
                  <button
                    onClick={() => musicInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Add Music
                  </button>
                </div>

                {currentLocalTrack ? (
                  <>
                    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3 border border-white/10">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                        <Music className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">
                          {currentLocalTrack.name}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Saved Locally • {currentLocalTrack.sizeLabel}
                        </div>
                      </div>
                      <button
                        onClick={handleToggleLocalMusic}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
                        aria-label={localPlaying && activeAudioSource === 'local-music' ? 'Pause' : 'Play'}
                      >
                        {localPlaying && activeAudioSource === 'local-music' ? (
                          <Pause className="h-4 w-4 fill-current" />
                        ) : (
                          <Play className="h-4 w-4 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <input
                        type="range"
                        min={0}
                        max={audioDuration || 1}
                        step={0.5}
                        value={Math.min(audioCurrentTime, audioDuration || 1)}
                        onChange={(e) => {
                          const t = Number(e.target.value);
                          setAudioCurrentTime(t);
                          if (audioRef.current) audioRef.current.currentTime = t;
                        }}
                        className="w-full accent-white cursor-pointer h-1"
                        aria-label="Seek track"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>{formatTime(audioCurrentTime)}</span>
                        <span>{formatTime(audioDuration)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={handlePrevTrack}
                        className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                        aria-label="Previous track"
                      >
                        <SkipBack className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleNextTrack}
                        className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                        aria-label="Next track"
                      >
                        <SkipForward className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex max-h-28 flex-col gap-1 overflow-y-auto pr-0.5">
                      {localTracks.map((track, idx) => {
                        const isCurrent = idx === localTrackIndex && activeAudioSource === 'local-music';
                        return (
                          <div
                            key={track.id}
                            className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs transition ${
                              isCurrent
                                ? 'bg-white/15 text-white border border-white/20'
                                : 'bg-white/[0.03] text-zinc-300 hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            <button
                              onClick={() => playLocalTrack(idx)}
                              className="min-w-0 flex-1 truncate text-left cursor-pointer"
                            >
                              {track.name}
                            </button>
                            <button
                              onClick={() => handleRemoveMusicTrack(track.id, idx)}
                              className="p-1 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                              aria-label={`Remove ${track.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => musicInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-6 text-center hover:border-white/30 hover:bg-white/[0.06] transition cursor-pointer"
                  >
                    <Music className="h-6 w-6 text-zinc-400" />
                    <div className="text-xs font-medium text-zinc-200">Tap to load local music</div>
                    <div className="text-[11px] text-zinc-500">Saved automatically across restarts</div>
                  </button>
                )}
              </div>
            )}

            {/* 3. Local Video Player (IndexedDB Persisted) */}
            {mediaMode === 'videos' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">
                    Saved Videos ({localVideos.length})
                  </span>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Add Videos
                  </button>
                </div>

                {currentLocalVideo ? (
                  <>
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                      <video
                        ref={videoRef}
                        key={currentLocalVideo.id}
                        src={currentLocalVideo.url}
                        controls
                        playsInline
                        onPlay={() => {
                          if (activeSourceRef.current !== 'none') stopAudio();
                        }}
                        className="h-36 w-full object-contain bg-black"
                      />
                      <button
                        onClick={() => setVideoFullscreen(true)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-white border border-white/15 hover:bg-black transition cursor-pointer"
                        aria-label="Expand video fullscreen"
                        title="Fullscreen"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex max-h-24 flex-col gap-1 overflow-y-auto pr-0.5">
                      {localVideos.map((vid, idx) => {
                        const isCurrent = idx === localVideoIndex;
                        return (
                          <div
                            key={vid.id}
                            className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs transition ${
                              isCurrent
                                ? 'bg-white/15 text-white border border-white/20'
                                : 'bg-white/[0.03] text-zinc-300 hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            <button
                              onClick={() => setLocalVideoIndex(idx)}
                              className="min-w-0 flex-1 truncate text-left cursor-pointer"
                            >
                              {vid.name}
                            </button>
                            <button
                              onClick={() => handleRemoveVideo(vid.id, idx)}
                              className="p-1 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                              aria-label={`Remove ${vid.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-6 text-center hover:border-white/30 hover:bg-white/[0.06] transition cursor-pointer"
                  >
                    <Film className="h-6 w-6 text-zinc-400" />
                    <div className="text-xs font-medium text-zinc-200">Tap to load local videos</div>
                    <div className="text-[11px] text-zinc-500">Saved automatically across restarts</div>
                  </button>
                )}
              </div>
            )}

            {/* Shared Master Volume Bar */}
            <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
              <span className="text-[11px] text-zinc-400">
                {activeAudioSource === 'radio'
                  ? `${activeStation.name} Live`
                  : activeAudioSource === 'local-music'
                    ? 'Local Audio'
                    : 'Master Volume'}
              </span>
              <div className="flex items-center gap-2 w-32">
                <Volume2 className="h-4 w-4 text-zinc-400 shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => onChangeVolume(Number(e.target.value))}
                  className="w-full accent-white cursor-pointer h-1"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Video Theater Overlay */}
        {videoFullscreen && currentLocalVideo && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-md">
            <div className="mb-3 flex w-full max-w-5xl items-center justify-between">
              <span className="truncate text-sm font-semibold text-white">
                {currentLocalVideo.name}
              </span>
              <button
                onClick={() => setVideoFullscreen(false)}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>
            <video
              src={currentLocalVideo.url}
              controls
              autoPlay
              playsInline
              onPlay={() => {
                if (activeSourceRef.current !== 'none') stopAudio();
              }}
              className="max-h-[82vh] w-full max-w-5xl rounded-2xl bg-black shadow-2xl"
            />
          </div>
        )}
      </div>
    </aside>
  );
};
