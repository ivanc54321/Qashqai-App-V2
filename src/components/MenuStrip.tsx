import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
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
  Calendar,
  Car,
  Disc,
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
} from 'lucide-react';
import type { CarHotspotState } from './CarScene';

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
  gpsCoords: string | null;
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

const KISS_FM_STATION = {
  name: 'KISS FM',
  subtitle: '100 FM • UK Live Radio',
  streams: [
    'https://stream-al.planetradio.co.uk/kissnational.aac',
    'https://stream-mz.planetradio.co.uk/kissnational.aac',
    'https://edge-bauerall-01-gos2.sharp-stream.com/kissnational.mp3',
    'https://edge-bauerall-01-gos2.sharp-stream.com/kissnational.aac',
  ],
};

const DESTINATIONS = [
  {
    name: 'Westwood Cross',
    address: 'Margate, Kent CT10 2BF',
    query: 'Westwood Cross, Margate, Kent, UK',
    eta: '6 min',
    distance: '2.1 mi',
    speedLimit: 30,
  },
  {
    name: 'Shell Diesel Station',
    address: 'Margate Road • Broadstairs',
    query: 'Shell, Margate Road, Broadstairs, Kent, UK',
    eta: '4 min',
    distance: '1.3 mi',
    speedLimit: 40,
  },
  {
    name: 'Margate Seafront',
    address: 'Marine Terrace, Margate',
    query: 'Margate Main Sands, Margate, Kent, UK',
    eta: '9 min',
    distance: '3.2 mi',
    speedLimit: 30,
  },
];

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
  gpsCoords,
}) => {
  const [mediaMode, setMediaMode] = useState<MediaMode>('radio');
  const [timeStr, setTimeStr] = useState('');
  const [activeDest, setActiveDest] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapQuery, setMapQuery] = useState(DESTINATIONS[0].query);
  const [mapLabel, setMapLabel] = useState(DESTINATIONS[0].name);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Live Radio (KISS FM) & Local Audio shared HTMLAudioElement
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const streamIdxRef = useRef(0);
  const activeSourceRef = useRef<ActiveAudioSource>('none');
  const createdUrlsRef = useRef<string[]>([]);

  const [activeAudioSource, setActiveAudioSource] = useState<ActiveAudioSource>('none');
  const [radioStatus, setRadioStatus] = useState<RadioStatus>('idle');

  // Local Music state
  const [localTracks, setLocalTracks] = useState<LocalMediaItem[]>([]);
  const [localTrackIndex, setLocalTrackIndex] = useState(0);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Local Videos state
  const [localVideos, setLocalVideos] = useState<LocalMediaItem[]>([]);
  const [localVideoIndex, setLocalVideoIndex] = useState(0);
  const [videoFullscreen, setVideoFullscreen] = useState(false);

  useEffect(() => {
    activeSourceRef.current = activeAudioSource;
    onRadioLiveChange(activeAudioSource === 'radio' && radioStatus === 'playing');
  }, [activeAudioSource, radioStatus, onRadioLiveChange]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const id = setInterval(updateTime, 10000);
    return () => clearInterval(id);
  }, []);

  // Sync volume to audio and video elements
  useEffect(() => {
    const v = Math.min(1, Math.max(0, volume / 100));
    if (audioRef.current) audioRef.current.volume = v;
    if (videoRef.current) videoRef.current.volume = v;
  }, [volume]);

  // Cleanup audio and blob URLs on unmount
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

  const startKissStreamAt = useCallback(
    (initialIdx: number) => {
      const tryStream = (idx: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        streamIdxRef.current = idx;
        audio.src = KISS_FM_STATION.streams[idx];
        audio.volume = volume / 100;
        audio.play().catch(() => {
          if (activeSourceRef.current !== 'radio') return;
          if (idx + 1 < KISS_FM_STATION.streams.length) {
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

  const handleToggleKissFm = () => {
    if (activeAudioSource === 'radio' && (radioStatus === 'playing' || radioStatus === 'loading')) {
      stopAudio();
      return;
    }
    if (videoRef.current) videoRef.current.pause();
    setLocalPlaying(false);
    setActiveAudioSource('radio');
    activeSourceRef.current = 'radio';
    setRadioStatus('loading');
    startKissStreamAt(0);
  };

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

  const handleToggleLocalMusic = () => {
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
  };

  const handleNextTrack = () => {
    if (localTracks.length === 0) return;
    const nextIdx = (localTrackIndex + 1) % localTracks.length;
    playLocalTrack(nextIdx);
  };

  const handlePrevTrack = () => {
    if (localTracks.length === 0) return;
    const prevIdx = (localTrackIndex - 1 + localTracks.length) % localTracks.length;
    playLocalTrack(prevIdx);
  };

  const handleAddMusicFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newItems: LocalMediaItem[] = files.map((file) => {
      const url = URL.createObjectURL(file);
      createdUrlsRef.current.push(url);
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        name: stripExtension(file.name),
        url,
        sizeLabel: formatFileSize(file.size),
      };
    });
    const updated = [...localTracks, ...newItems];
    setLocalTracks(updated);
    setMediaMode('music');
    if (activeAudioSource !== 'local-music') {
      playLocalTrack(localTracks.length, updated);
    }
    e.target.value = '';
  };

  const handleRemoveMusicTrack = (id: string, idx: number) => {
    const target = localTracks[idx];
    if (target) URL.revokeObjectURL(target.url);
    const updated = localTracks.filter((t) => t.id !== id);
    setLocalTracks(updated);
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

  const handleAddVideoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newItems: LocalMediaItem[] = files.map((file) => {
      const url = URL.createObjectURL(file);
      createdUrlsRef.current.push(url);
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        name: stripExtension(file.name),
        url,
        sizeLabel: formatFileSize(file.size),
      };
    });
    const startIdx = localVideos.length;
    setLocalVideos((prev) => [...prev, ...newItems]);
    setLocalVideoIndex(startIdx);
    setMediaMode('videos');
    e.target.value = '';
  };

  const handleRemoveVideo = (id: string, idx: number) => {
    const target = localVideos[idx];
    if (target) URL.revokeObjectURL(target.url);
    const updated = localVideos.filter((v) => v.id !== id);
    setLocalVideos(updated);
    if (updated.length === 0) {
      setLocalVideoIndex(0);
      setVideoFullscreen(false);
    } else if (idx <= localVideoIndex) {
      setLocalVideoIndex(Math.max(0, Math.min(localVideoIndex - (idx < localVideoIndex ? 1 : 0), updated.length - 1)));
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

  // Live MOT status calculation (MOT valid until 18 October 2026)
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

          {/* Tab Icons (tap to expand directly to that tab + glide camera) */}
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
                onClick={() => {
                  onSelectTab(key);
                }}
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

          {/* Quick Car Controls (toggle unobstructed without forcing menu open) */}
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

      {/* Full Expanded Menu (kept mounted via CSS hidden so audio/maps state persists seamlessly) */}
      <div className={isCollapsed ? 'hidden' : 'flex h-full w-full flex-col gap-2.5'}>
        {/* Sleek Top Status Bar + Tab Switcher */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/65 px-3.5 py-2 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <Fuel className="h-3.5 w-3.5" />
              76%
            </span>
            <span className="hidden sm:inline text-xs font-semibold tracking-wide text-white truncate">
              NISSAN QASHQAI
            </span>
            <span className="rounded bg-[#facc15] px-1.5 py-0.5 text-[10px] font-black tracking-wider text-zinc-950">
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

      {/* Tab 1: Overview (Vehicle Profile, MOT Status & Live Telemetry) */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-3">
          {/* MOT & Vehicle Details Card */}
          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {motExpired ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  MOT Status
                </span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                  motExpired
                    ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                    : motSoon
                    ? 'bg-amber-500/15 text-amber-200 border-amber-400/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                }`}
              >
                {motExpired ? 'MOT Expired' : motSoon ? `Due in ${daysUntilMot}d` : 'Valid'}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xs text-zinc-400">Valid until</span>
              <span className="text-sm font-bold text-white">18 October 2026</span>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2.5 text-xs">
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <Car className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-zinc-500">Colour</div>
                  <div className="font-semibold text-white">Black</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <Fuel className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-zinc-500">Fuel Type</div>
                  <div className="font-semibold text-white">Diesel</div>
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="flex items-center gap-2 text-zinc-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Date Registered</span>
                </span>
                <span className="font-semibold text-white">28 November 2012</span>
              </div>
            </div>
          </div>

          {/* Live Trip & Telemetry Strip */}
          <div className="grid grid-cols-2 gap-2.5 rounded-3xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-3">
              <Gauge className="h-4 w-4 text-zinc-300 shrink-0" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Avg MPG</div>
                <div className="text-sm font-bold text-white">54.2 mpg</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-3">
              <Fuel className="h-4 w-4 text-zinc-300 shrink-0" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Range</div>
                <div className="text-sm font-bold text-white">410 mi</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-3">
              <Thermometer className="h-4 w-4 text-zinc-300 shrink-0" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Temp</div>
                <div className="text-sm font-bold text-white">11°C / 90°C</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-3">
              <Disc className="h-4 w-4 text-zinc-300 shrink-0" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Tyres</div>
                <div className="text-sm font-bold text-white">33 PSI • OK</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Full-Height Tesla-Style Dark Google Maps Navigation */}
      {activeTab === 'navigation' && (
        <div className="relative flex-1 min-h-[340px] w-full overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 shadow-2xl">
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

          {/* Subtle dark vignette */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 shadow-[inset_0_0_28px_rgba(0,0,0,0.6)]" />

          {/* Floating Top-Left: Blue Turn-by-Turn Card + UK Speed Limit Badge */}
          <div className="absolute left-3 top-3 flex flex-col gap-2 max-w-[230px]">
            <div className="flex items-center gap-2.5 rounded-xl bg-blue-600/95 px-3 py-2 text-white shadow-xl backdrop-blur-md">
              <ArrowUp className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight">
                  {DESTINATIONS[activeDest]?.distance ?? '2.1 mi'}
                </div>
                <div className="truncate text-[11px] text-blue-100">
                  Toward {mapLabel}
                </div>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-[3.5px] border-red-500 bg-white text-xs font-black text-zinc-950 shadow-lg">
              {DESTINATIONS[activeDest]?.speedLimit ?? 30}
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
              <Search className="ml-1.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search postcode or place..."
                className="w-36 sm:w-44 bg-transparent px-1.5 py-1 text-xs text-white placeholder-zinc-500 outline-none"
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

      {/* Persistent Audio Element & Hidden File Pickers (survives tab switches) */}
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
              const nextIdx = (localTrackIndex + 1) % localTracks.length;
              playLocalTrack(nextIdx);
            } else {
              setLocalPlaying(false);
            }
          }
        }}
        onError={() => {
          if (activeSourceRef.current === 'radio') {
            const nextIdx = streamIdxRef.current + 1;
            if (nextIdx < KISS_FM_STATION.streams.length) {
              startKissStreamAt(nextIdx);
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

      {/* Tab 3: Media Hub (Radio • Local Music • Local Videos) */}
      {activeTab === 'media' && (
        <div className="flex flex-col gap-3.5 rounded-3xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl shadow-2xl">
          {/* Media Source Selector */}
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

          {/* 1. Live Radio: One-Click KISS FM UK */}
          {mediaMode === 'radio' && (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleToggleKissFm}
                className={`group flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                  activeAudioSource === 'radio' && (radioStatus === 'playing' || radioStatus === 'loading')
                    ? 'border-pink-500/50 bg-gradient-to-r from-pink-600/25 via-fuchsia-600/15 to-black/40 shadow-lg'
                    : 'border-white/15 bg-white/[0.05] hover:border-white/30 hover:bg-white/10'
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-800 text-white font-black tracking-tight text-sm shadow-md">
                  KISS
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">{KISS_FM_STATION.name}</span>
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
                        : KISS_FM_STATION.subtitle}
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

              {activeAudioSource === 'radio' && radioStatus === 'playing' && (
                <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-pink-400" />
                    On Air • Tap KISS FM to stop
                  </span>
                  <span className="font-mono text-zinc-400">100.0 FM</span>
                </div>
              )}
            </div>
          )}

          {/* 2. Local Music Player */}
          {mediaMode === 'music' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  Local Music ({localTracks.length})
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
                        Local Audio • {currentLocalTrack.sizeLabel}
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

                  {/* Seek Bar */}
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

                  {/* Playlist */}
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
                  <div className="text-[11px] text-zinc-500">MP3, M4A, WAV, FLAC from your device</div>
                </button>
              )}
            </div>
          )}

          {/* 3. Local Video Player */}
          {mediaMode === 'videos' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  Local Videos ({localVideos.length})
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
                  <div className="text-[11px] text-zinc-500">MP4, WebM, MOV from your device</div>
                </button>
              )}
            </div>
          )}

          {/* Shared Master Volume Bar */}
          <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
            <span className="text-[11px] text-zinc-400">
              {activeAudioSource === 'radio'
                ? 'KISS FM Live'
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
