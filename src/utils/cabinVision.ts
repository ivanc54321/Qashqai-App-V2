export type DetectedGesture = 'wave-left' | 'wave-right' | 'palm-hold';

export interface MotionStats {
  /** Perceptual brightness 0..255 */
  luminance: number;
  /** Percentage of pixels with noticeable frame-to-frame motion (0..100) */
  motionPercent: number;
  /** Horizontal motion centroid in 0..1 (0 = left, 1 = right), or null if low motion */
  centroidX: number | null;
  /** Center-region brightness 0..255 (used for palm-close hold detection) */
  centerLuminance: number;
}

/**
 * Computes average perceptual luminance and frame-to-frame motion stats
 * on a tiny 64x48 RGBA ImageData buffer (< 1ms per frame).
 */
export function analyzeFrame(
  curr: Uint8ClampedArray,
  prev: Uint8ClampedArray | null,
  width: number,
  height: number
): MotionStats {
  const pixelCount = width * height;
  let lumSum = 0;
  let centerLumSum = 0;
  let centerCount = 0;
  let movedPixels = 0;
  let weightedXSum = 0;

  const xMin = Math.floor(width * 0.25);
  const xMax = Math.floor(width * 0.75);
  const yMin = Math.floor(height * 0.2);
  const yMax = Math.floor(height * 0.8);

  for (let i = 0; i < pixelCount; i += 1) {
    const idx = i * 4;
    const r = curr[idx];
    const g = curr[idx + 1];
    const b = curr[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lumSum += lum;

    const x = i % width;
    const y = (i - x) / width;

    if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
      centerLumSum += lum;
      centerCount += 1;
    }

    if (prev) {
      const prevLum = 0.299 * prev[idx] + 0.587 * prev[idx + 1] + 0.114 * prev[idx + 2];
      if (Math.abs(lum - prevLum) > 26) {
        movedPixels += 1;
        weightedXSum += x / width;
      }
    }
  }

  const luminance = lumSum / Math.max(1, pixelCount);
  const centerLuminance = centerLumSum / Math.max(1, centerCount);
  const motionPercent = (movedPixels / Math.max(1, pixelCount)) * 100;
  const centroidX = movedPixels > pixelCount * 0.04 ? weightedXSum / movedPixels : null;

  return { luminance, motionPercent, centroidX, centerLuminance };
}

/** Gentle dual-tone chime for driver fatigue / motorway break alerts */
export function playFatigueChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.16);
      gain.gain.setValueAtTime(0.001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.16 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.24);
    });
  } catch {
    // Ignore autoplay restrictions
  }
}
