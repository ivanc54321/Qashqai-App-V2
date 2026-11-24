import React from 'react';
import {
  Car,
  Gauge,
  Radio,
  Camera,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Monitor,
  Globe,
} from 'lucide-react';

interface AboutPanelProps {
  isCompact?: boolean;
}

export const AboutPanel: React.FC<AboutPanelProps> = ({ isCompact = false }) => {
  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Flagship Brand Hero Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-zinc-900/95 via-black/90 to-sky-950/40 p-5 sm:p-6 backdrop-blur-xl shadow-2xl">
        {/* Subtle top accent bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-emerald-400" />

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3.5">
            {/* VIAN VISION Geometric Monogram */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/35 bg-gradient-to-br from-sky-500/25 via-blue-600/20 to-black shadow-lg">
              <span className="text-base font-black tracking-tighter text-white">VV</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-400">
                  VIAN VISION
                </span>
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold text-zinc-300">
                  v2.0
                </span>
              </div>
              <h2 className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold tracking-tight text-white leading-tight mt-0.5`}>
                DriveSmart
              </h2>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-200">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            <span>Founded by Ivan Clague</span>
          </div>
        </div>

        {/* Exact Brand Mission Copy */}
        <p className="mt-4 text-xs sm:text-[13px] leading-relaxed text-zinc-200">
          <strong className="font-semibold text-white">DriveSmart</strong> is a universal car control
          app designed to manage, monitor, and personalize your driving experience. Control key
          vehicle functions, track performance, and access real-time insights through a clean,
          intuitive interface that keeps drivers connected, informed, and in control anywhere.
        </p>

        {/* Creator Attribution Strip */}
        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[11px]">
          <div className="flex items-center gap-2 text-zinc-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Created by <strong className="text-white">VIAN VISION</strong> — Founded by{' '}
              <strong className="text-white">Ivan Clague</strong>
            </span>
          </div>
          <span className="rounded bg-[#facc15] px-1.5 py-0.5 text-[10px] font-black tracking-wider text-zinc-950">
            WG62 HJC
          </span>
        </div>
      </div>

      {/* 4 Core Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
            <Car className="h-4 w-4 text-sky-400 shrink-0" />
            <span>Universal Vehicle Control</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Interactive 3D vehicle stage with instant access to lights, doors, boot, dual-zone
            climate, heated seats, and Eco / Comfort / Sport drive modes.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/60 p-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
            <Gauge className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Real-Time Insights & Radar</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Live GPS speedometer, UK speed camera proximity alerts, OBD-II &amp; DPF telemetry,
            service logs, and auto-saved parked car location.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/60 p-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
            <Radio className="h-4 w-4 text-fuchsia-400 shrink-0" />
            <span>Connected Media &amp; Voice AI</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            13 UK Urban &amp; Mainstream radio stations, Spotify, YouTube, persistent local media,
            and hands-free Voice AI co-pilot.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/60 p-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
            <Camera className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Smart Cabin Vision</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            100% on-device front camera intelligence for hand-wave gestures, auto night-dim,
            dashcam loop recording, parked sentry, and fatigue alerts.
          </p>
        </div>
      </div>

      {/* Platform & Vehicle Profile Footer */}
      <div className="flex items-center justify-between gap-2 flex-wrap rounded-2xl border border-white/10 bg-black/55 px-3.5 py-2.5 text-[11px] text-zinc-400">
        <span>Active Profile: 2012 Nissan Qashqai J10 Diesel</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-300">
            <Smartphone className="h-3 w-3" /> Android
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-300">
            <Monitor className="h-3 w-3" /> Windows
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-300">
            <Globe className="h-3 w-3" /> Web
          </span>
        </div>
      </div>
    </div>
  );
};
