import React, { useState } from 'react';
import type { LayoutMode } from './CarScene';

interface MobileLandingOverlayProps {
  layoutMode: LayoutMode;
  onStart: () => void;
  onOpenAbout: () => void;
}

function playStartupChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Sleek warm automotive ignition harmonic swell
    const freqs = [220, 329.63, 440, 659.25];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.001, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(idx === 0 ? 0.14 : 0.08, now + idx * 0.06 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.06 + 0.72);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.75);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

export const MobileLandingOverlay: React.FC<MobileLandingOverlayProps> = ({
  layoutMode,
  onStart,
  onOpenAbout,
}) => {
  const [starting, setStarting] = useState(false);

  const handleStart = () => {
    if (starting) return;
    setStarting(true);
    playStartupChime();
    window.setTimeout(() => {
      onStart();
    }, 360);
  };

  const isHorizontal = layoutMode === 'horizontal-mobile';

  return (
    <div
      className={`fixed inset-0 z-50 flex overflow-hidden pointer-events-none transition-all duration-500 ${
        starting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Top & Bottom subtle vignette so typography & START button pop over the 3D Qashqai */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 54%, rgba(0,0,0,0.02) 18%, rgba(0,0,0,0.68) 72%, rgba(0,0,0,0.92) 100%)',
        }}
      />

      {/* Concentric Radar Aura Rings + Subtle Red Taillight & White Headlight Glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {/* Top crimson taillight ambient glow */}
        <div
          className="absolute h-28 w-44 rounded-full blur-3xl opacity-45"
          style={{
            top: isHorizontal ? '14%' : '28%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.55) 0%, transparent 70%)',
          }}
        />

        {/* Concentric pill-shaped radar aura rings surrounding the top-down Qashqai */}
        <svg
          viewBox="0 0 360 560"
          className={`${isHorizontal ? 'h-[92%] w-auto' : 'w-[86%] max-w-[360px] h-auto'} opacity-80`}
          style={{ transform: isHorizontal ? 'translateY(2%)' : 'translateY(6%)' }}
        >
          <rect
            x="66"
            y="88"
            width="228"
            height="384"
            rx="114"
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="1"
          />
          <rect
            x="48"
            y="66"
            width="264"
            height="428"
            rx="132"
            fill="none"
            stroke="rgba(255,255,255,0.065)"
            strokeWidth="1"
          />
          <rect
            x="30"
            y="44"
            width="300"
            height="472"
            rx="150"
            fill="none"
            stroke="rgba(255,255,255,0.045)"
            strokeWidth="1"
          />
          <rect
            x="12"
            y="22"
            width="336"
            height="516"
            rx="168"
            fill="none"
            stroke="rgba(255,255,255,0.025)"
            strokeWidth="1"
          />
        </svg>

        {/* Twin Volumetric White Headlight Beams shining downward toward START */}
        {!isHorizontal && (
          <div
            className="absolute bottom-[13%] flex items-start justify-center gap-16 opacity-65"
            aria-hidden="true"
          >
            <div
              className="h-40 w-20 -rotate-12 blur-xl"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(186,230,253,0.18) 55%, transparent 100%)',
              }}
            />
            <div
              className="h-40 w-20 rotate-12 blur-xl"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(186,230,253,0.18) 55%, transparent 100%)',
              }}
            />
          </div>
        )}
      </div>

      {/* Foreground Content Layer */}
      <div
        className={`relative z-10 flex h-full w-full ${
          isHorizontal
            ? 'flex-row items-center justify-between px-7 py-5'
            : 'flex-col justify-between px-6 pt-10 pb-8'
        }`}
      >
        {/* Top-Left Editorial Stacked Typography */}
        <div className="pointer-events-auto select-none">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`${
                isHorizontal ? 'text-4xl' : 'text-[44px]'
              } font-semibold italic tracking-tight leading-none text-white`}
            >
              Smart
            </span>
            <div className="relative inline-flex items-center">
              <span className="rounded-full bg-[#e5d025] px-3 py-1 text-[11px] font-bold tracking-tight text-zinc-950 shadow-[0_6px_20px_rgba(229,208,37,0.3)]">
                Universal Car
              </span>
              {/* Subtle curved pointer tail matching reference */}
              <svg
                viewBox="0 0 28 18"
                className="pointer-events-none absolute -bottom-3.5 left-4 h-4 w-7 text-[#e5d025]"
                fill="none"
              >
                <path
                  d="M 16 0 C 16 10, 8 13, 1 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <div
            className={`${
              isHorizontal ? 'text-4xl' : 'text-[44px]'
            } font-semibold tracking-tight leading-[1.06] text-white mt-1`}
          >
            controller for
          </div>

          <div
            className={`${
              isHorizontal ? 'text-4xl' : 'text-[42px]'
            } font-semibold tracking-tight leading-[1.08] text-zinc-500`}
          >
            Nissan Qashqai
          </div>

          <div className="mt-2.5 flex items-center gap-2 text-[11px] font-medium tracking-wide text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e5d025]" />
            <span>DriveSmart by VIAN VISION</span>
          </div>
        </div>

        {/* Bottom Center Circular START Ignition Button */}
        <div
          className={`pointer-events-auto flex flex-col items-center ${
            isHorizontal ? 'gap-2.5' : 'gap-3.5'
          }`}
        >
          <button
            type="button"
            onClick={handleStart}
            aria-label="Start DriveSmart Dashboard"
            className="group relative flex h-28 w-28 items-center justify-center rounded-full cursor-pointer focus:outline-none active:scale-95 transition-transform"
          >
            {/* Outer subtle glass ring */}
            <span className="absolute inset-0 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-md transition group-hover:border-white/30" />

            {/* Animated Orbital Arc + Glowing Dot */}
            <svg
              viewBox="0 0 120 120"
              className="absolute inset-0 h-full w-full animate-[spin_6s_linear_infinite]"
            >
              <defs>
                <linearGradient id="startArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="url(#startArcGrad)"
                strokeWidth="1.6"
                strokeDasharray="110 220"
                strokeLinecap="round"
              />
              <circle cx="8" cy="60" r="3" fill="#ffffff" />
            </svg>

            {/* Inner dark ignition core */}
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-black/90 text-sm font-semibold tracking-[0.18em] text-white shadow-[0_0_30px_rgba(0,0,0,0.9)] transition group-hover:bg-zinc-900">
              START
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAbout}
            className="text-[10px] font-medium tracking-wider uppercase text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
          >
            VIAN VISION • Founded by Ivan Clague
          </button>
        </div>
      </div>
    </div>
  );
};
