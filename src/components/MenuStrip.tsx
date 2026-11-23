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
  Clock,
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
} from 'lucide-react';
import type { CarHotspotState, CameraPreset } from './CarScene';

interface MenuStripProps {
  hotspotState: CarHotspotState;
  onToggleHotspot: (key: keyof CarHotspotState) => void;
  onSelectCameraPreset: (preset: CameraPreset) => void;
}

type TabKey = 'overview' | 'navigation' | 'media';
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
  { name: 'Home', address: 'Bristol, UK', eta: '14 min', distance: '6.2 mi' },
  { name: 'Shell Diesel Station', address: 'Bath Road • Open 24h', eta: '5 min', distance: '1.8 mi' },
  { name: 'City Centre', address: 'Cabot Circus Parking', eta: '19 min', distance: '8.4 mi' },
];

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const stripExtension = (filename: string) => filename.replace(/\.[^/.]+$/, '');

export const MenuStrip: React.FC<MenuStripProps> = ({
  hotspotState,
  onToggleHotspot,
  onSelectCameraPreset,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [mediaMode, setMediaMode] = useState<MediaMode>('radio');
  const [timeStr, setTimeStr] = useState('');
  const [volume, setVolume] = useState(80);
  const [activeDest, setActiveDest] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

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
  }, [activeAudioSource]);

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
    <aside className="flex w-full flex-col gap-3 text-zinc-100">
      {/* Persistent Top Status Bar + UK Plate Header */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-white border border-white/15">
              P
            </span>
            <span className="text-[11px] font-semibold tracking-widest text-zinc-300">READY</span>
          </div>
          <div className="flex items-center gap-3.5 text-xs text-zinc-300">
            <span className="flex items-center gap-1.5" title="Diesel Fuel">
              <Fuel className="h-3.5 w-3.5 text-zinc-200" />
              <span className="font-medium text-white">76%</span>
              <span className="text-zinc-400">• 410 mi</span>
            </span>
            <span className="flex items-center gap-1 text-zinc-300">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <span className="font-medium text-white">{timeStr || '12:16'}</span>
            </span>
          </div>
        </div>

        {/* UK Number Plate + Model Title */}
        <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
          <div>
            <div className="text-sm font-bold tracking-wide text-white">NISSAN QASHQAI</div>
            <div className="text-[11px] text-zinc-400">Black • Diesel • Reg. 28 Nov 2012</div>
          </div>
          <div className="rounded-md bg-[#facc15] px-2.5 py-1 text-xs font-black tracking-wider text-zinc-950 shadow-sm border border-yellow-300/60">
            WG62 HJC
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/55 p-1 backdrop-blur-xl">
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
              onClick={() => {
                setActiveTab(tab.key);
                onSelectCameraPreset(tab.key);
              }}
              className={`rounded-xl py-2 text-xs font-semibold transition cursor-pointer ${
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

      {/* Tab 2: Navigation */}
      {activeTab === 'navigation' && (
        <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/55 p-5 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                <Navigation className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-white">Navigation</h2>
                <p className="text-xs text-zinc-400">
                  {DESTINATIONS[activeDest].eta} • {DESTINATIONS[activeDest].distance}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-zinc-200 border border-white/10">
              Fastest Route
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search destination..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-white/30 focus:bg-white/10 transition"
            />
          </div>

          <div className="flex flex-col gap-2">
            {filteredDests.map((dest) => {
              const idx = DESTINATIONS.indexOf(dest);
              const isSelected = idx === activeDest;
              return (
                <button
                  key={dest.name}
                  onClick={() => setActiveDest(idx)}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-white/12 border border-white/25 text-white'
                      : 'bg-white/[0.04] border border-transparent text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-zinc-500'}`} />
                    <div>
                      <div className="text-xs font-semibold">{dest.name}</div>
                      <div className="text-[11px] text-zinc-400">{dest.address}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-white">{dest.eta}</div>
                    <div className="text-[11px] text-zinc-500">{dest.distance}</div>
                  </div>
                </button>
              );
            })}
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
                onChange={(e) => setVolume(Number(e.target.value))}
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

      {/* Pinned Quick Car Controls */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => onToggleHotspot('headlights')}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 backdrop-blur-xl transition cursor-pointer ${
            hotspotState.headlights
              ? 'border-white/35 bg-white/15 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Lightbulb className="h-4 w-4" />
          <span className="text-xs font-medium">Lights</span>
        </button>

        <button
          onClick={() => onToggleHotspot('doorsOpen')}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 backdrop-blur-xl transition cursor-pointer ${
            hotspotState.doorsOpen
              ? 'border-white/35 bg-white/15 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <DoorOpen className="h-4 w-4" />
          <span className="text-xs font-medium">Doors</span>
        </button>

        <button
          onClick={() => onToggleHotspot('trunkOpen')}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 backdrop-blur-xl transition cursor-pointer ${
            hotspotState.trunkOpen
              ? 'border-white/35 bg-white/15 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <PackageOpen className="h-4 w-4" />
          <span className="text-xs font-medium">Trunk</span>
        </button>
      </div>
    </aside>
  );
};
