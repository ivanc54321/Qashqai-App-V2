import React, { useState, useEffect } from 'react';
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
  BatteryCharging,
  Search,
} from 'lucide-react';
import type { CarHotspotState } from './CarScene';

interface MenuStripProps {
  hotspotState: CarHotspotState;
  onToggleHotspot: (key: keyof CarHotspotState) => void;
}

const TRACKS = [
  {
    title: 'Midnight Drive',
    artist: 'Synthwave Collective',
    duration: 214,
    coverGradient: 'from-zinc-700 via-zinc-800 to-black',
  },
  {
    title: 'Neon Horizon',
    artist: 'Kavinsky & Friends',
    duration: 198,
    coverGradient: 'from-neutral-600 via-neutral-800 to-black',
  },
  {
    title: 'Electric Avenue',
    artist: 'Autobahn',
    duration: 242,
    coverGradient: 'from-slate-700 via-zinc-900 to-black',
  },
];

const DESTINATIONS = [
  { name: 'Home', address: '742 Evergreen Terrace', eta: '14 min', distance: '6.2 mi' },
  { name: 'Downtown Studio', address: '450 Mission St', eta: '22 min', distance: '11.4 mi' },
  { name: 'Supercharger', address: '800 Howard St • 12/16 open', eta: '9 min', distance: '3.8 mi' },
];

export const MenuStrip: React.FC<MenuStripProps> = ({ hotspotState, onToggleHotspot }) => {
  const [timeStr, setTimeStr] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [trackIndex, setTrackIndex] = useState(0);
  const [progress, setProgress] = useState(64);
  const [volume, setVolume] = useState(72);
  const [activeDest, setActiveDest] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

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
    if (!isPlaying) return;
    const id = setInterval(() => {
      setProgress((prev) => {
        if (prev >= TRACKS[trackIndex].duration) {
          setTrackIndex((i) => (i + 1) % TRACKS.length);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, trackIndex]);

  const currentTrack = TRACKS[trackIndex];
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleNext = () => {
    setTrackIndex((i) => (i + 1) % TRACKS.length);
    setProgress(0);
  };

  const handlePrev = () => {
    setTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);
    setProgress(0);
  };

  const filteredDests = DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="flex w-full flex-col gap-3.5 text-zinc-100">
      {/* Top Status Strip */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/55 px-5 py-3 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white border border-white/15">
            P
          </span>
          <span className="text-xs font-medium tracking-widest text-zinc-300">READY</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-300">
          <span className="flex items-center gap-1.5">
            <BatteryCharging className="h-4 w-4 text-zinc-200" />
            <span>84%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-zinc-400" />
            <span className="font-medium text-white">{timeStr || '23:21'}</span>
          </span>
        </div>
      </div>

      {/* Navigation Card */}
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

        {/* Search input */}
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

        {/* Destination list */}
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

      {/* Media Now Playing Card */}
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/55 p-5 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-4">
          <div
            className={`h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br ${currentTrack.coverGradient} border border-white/10 shadow-lg flex items-center justify-center`}
          >
            <div className="h-4 w-4 rounded-full bg-white/25 backdrop-blur-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{currentTrack.title}</div>
            <div className="truncate text-xs text-zinc-400">{currentTrack.artist}</div>
          </div>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${(progress / currentTrack.duration) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Controls & Volume */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              aria-label="Next track"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

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

      {/* Quick Car Controls */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onToggleHotspot('headlights')}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 backdrop-blur-xl transition cursor-pointer ${
            hotspotState.headlights
              ? 'border-white/35 bg-white/15 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Lightbulb className="h-5 w-5" />
          <span className="text-xs font-medium">Lights</span>
        </button>

        <button
          onClick={() => onToggleHotspot('doorsOpen')}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 backdrop-blur-xl transition cursor-pointer ${
            hotspotState.doorsOpen
              ? 'border-white/35 bg-white/15 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <DoorOpen className="h-5 w-5" />
          <span className="text-xs font-medium">Doors</span>
        </button>

        <button
          onClick={() => onToggleHotspot('trunkOpen')}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 backdrop-blur-xl transition cursor-pointer ${
            hotspotState.trunkOpen
              ? 'border-white/35 bg-white/15 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <PackageOpen className="h-5 w-5" />
          <span className="text-xs font-medium">Trunk</span>
        </button>
      </div>
    </aside>
  );
};
