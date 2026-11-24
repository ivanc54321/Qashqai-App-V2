import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Video,
  Hand,
  SunMoon,
  ShieldAlert,
  Coffee,
  FlipHorizontal2,
  Download,
  Trash2,
  Play,
  X,
  Save,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  loadCabinCaptures,
  saveCabinCapture,
  deleteCabinCapture,
  type CabinCaptureRecord,
} from '../utils/cabinCamStore';
import { analyzeFrame, playFatigueChime, type DetectedGesture } from '../utils/cabinVision';

export interface CabinCamControlApi {
  enableCamera: () => Promise<void>;
  disableCamera: () => void;
  saveClip: () => Promise<boolean>;
  setSentryEnabled: (enabled: boolean) => void;
}

interface CabinCamPanelProps {
  visible: boolean;
  gear: 'P' | 'R' | 'N' | 'D';
  speedMph: number;
  onActiveChange: (active: boolean) => void;
  onGestureDetected: (gesture: DetectedGesture) => void;
  onAutoNightDim: (dim: boolean) => void;
  onFatigueAlert: () => void;
  onRegisterControl?: (api: CabinCamControlApi) => void;
  isCompact?: boolean;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatStamp = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const CabinCamPanel: React.FC<CabinCamPanelProps> = ({
  visible,
  gear,
  speedMph,
  onActiveChange,
  onGestureDetected,
  onAutoNightDim,
  onFatigueAlert,
  onRegisterControl,
  isCompact = false,
}) => {
  const [camActive, setCamActive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [mirrorView, setMirrorView] = useState(true);

  // Feature toggles
  const [gesturesEnabled, setGesturesEnabled] = useState(true);
  const [autoDimEnabled, setAutoDimEnabled] = useState(true);
  const [sentryEnabled, setSentryEnabled] = useState(true);
  const [fatigueEnabled, setFatigueEnabled] = useState(true);

  // Live telemetry from vision loop
  const [luxPercent, setLuxPercent] = useState<number>(50);
  const [motionPercent, setMotionPercent] = useState<number>(0);
  const [lastGestureLabel, setLastGestureLabel] = useState<string | null>(null);
  const [savingClip, setSavingClip] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Gallery state
  const [captures, setCaptures] = useState<CabinCaptureRecord[]>([]);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'dashcam-clip' | 'sentry-snapshot'>('all');
  const [previewItem, setPreviewItem] = useState<{ record: CabinCaptureRecord; url: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordRafRef = useRef<number | null>(null);

  // Refs for latest props/toggles inside intervals
  const gearRef = useRef(gear);
  const speedRef = useRef(speedMph);
  const mirrorRef = useRef(mirrorView);
  const togglesRef = useRef({
    gestures: gesturesEnabled,
    autoDim: autoDimEnabled,
    sentry: sentryEnabled,
    fatigue: fatigueEnabled,
  });

  useEffect(() => {
    gearRef.current = gear;
    speedRef.current = speedMph;
    mirrorRef.current = mirrorView;
    togglesRef.current = {
      gestures: gesturesEnabled,
      autoDim: autoDimEnabled,
      sentry: sentryEnabled,
      fatigue: fatigueEnabled,
    };
  });

  // Load saved clips & sentry snapshots from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    void loadCabinCaptures().then((items) => {
      if (mounted) setCaptures(items);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setSavedToast(msg);
    window.setTimeout(() => {
      setSavedToast((curr) => (curr === msg ? null : curr));
    }, 2600);
  }, []);

  const stopCamera = useCallback(() => {
    if (recordRafRef.current !== null) {
      cancelAnimationFrame(recordRafRef.current);
      recordRafRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamActive(false);
    onActiveChange(false);
  }, [onActiveChange]);

  const startLoopRecorder = useCallback((videoEl: HTMLVideoElement) => {
    if (typeof MediaRecorder === 'undefined') return;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    recordCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastDraw = 0;
    const drawFrame = (ts: number) => {
      if (!streamRef.current) return;
      if (ts - lastDraw >= 66 && videoEl.readyState >= 2) {
        lastDraw = ts;
        ctx.save();
        if (mirrorRef.current) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Stamp Qashqai HUD bar at bottom of recorded clip
        ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
        ctx.fillRect(0, canvas.height - 28, canvas.width, 28);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('WG62 HJC', 10, canvas.height - 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 12px sans-serif';
        const stamp = new Date().toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        ctx.fillText(
          `QASHQAI V2  •  ${speedRef.current} MPH  •  GEAR ${gearRef.current}  •  ${stamp}`,
          88,
          canvas.height - 10
        );
      }
      recordRafRef.current = requestAnimationFrame(drawFrame);
    };
    recordRafRef.current = requestAnimationFrame(drawFrame);

    try {
      const canvasStream = canvas.captureStream(15);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';
      const rec = mimeType
        ? new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 900_000 })
        : new MediaRecorder(canvasStream);

      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          // Keep rolling ~15 seconds (15 chunks of 1s each)
          if (chunksRef.current.length > 16) {
            chunksRef.current.shift();
          }
        }
      };
      rec.start(1000);
      recorderRef.current = rec;
    } catch {
      // MediaRecorder unsupported on this browser
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Camera API unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        startLoopRecorder(videoRef.current);
      }
      setCamActive(true);
      onActiveChange(true);
    } catch {
      setCamError('Front camera permission denied or no camera found.');
      setCamActive(false);
      onActiveChange(false);
    }
  }, [onActiveChange, startLoopRecorder]);

  const captureSentrySnapshot = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.readyState < 2) return;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 640;
    snapCanvas.height = 360;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, snapCanvas.width, snapCanvas.height);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
    ctx.fillRect(0, 0, snapCanvas.width, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(
      `SENTRY MOTION DETECTED  •  WG62 HJC  •  ${new Date().toLocaleTimeString('en-GB')}`,
      10,
      17
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      snapCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
    );
    if (!blob) return;

    const record: CabinCaptureRecord = {
      id: `sentry-${Date.now()}`,
      kind: 'sentry-snapshot',
      createdAt: new Date().toISOString(),
      label: 'Sentry Motion • Parked',
      sizeBytes: blob.size,
      mimeType: 'image/jpeg',
      blob,
    };
    await saveCabinCapture(record);
    setCaptures((prev) => [record, ...prev]);
    showToast('Sentry snapshot saved');
  }, [showToast]);

  const handleSaveClip = useCallback(async (): Promise<boolean> => {
    if (!camActive) return false;
    setSavingClip(true);
    try {
      let blob: Blob | null = null;
      let mimeType = 'video/webm';

      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recorderRef.current.requestData();
        } catch {
          // ignore
        }
        await new Promise((r) => window.setTimeout(r, 250));
      }

      if (chunksRef.current.length > 0) {
        mimeType = chunksRef.current[0].type || 'video/webm';
        blob = new Blob(chunksRef.current, { type: mimeType });
      } else if (recordCanvasRef.current) {
        // Fallback to JPEG snapshot if MediaRecorder hasn't emitted a chunk yet
        mimeType = 'image/jpeg';
        blob = await new Promise<Blob | null>((resolve) =>
          recordCanvasRef.current?.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
        );
      }

      if (!blob) return false;

      const record: CabinCaptureRecord = {
        id: `clip-${Date.now()}`,
        kind: 'dashcam-clip',
        createdAt: new Date().toISOString(),
        label: `Dashcam Clip • ${speedRef.current} mph`,
        sizeBytes: blob.size,
        mimeType,
        blob,
      };
      await saveCabinCapture(record);
      setCaptures((prev) => [record, ...prev]);
      showToast(`Saved clip (${formatBytes(blob.size)})`);
      return true;
    } finally {
      setSavingClip(false);
    }
  }, [camActive, showToast]);

  // Register voice assistant camera API
  useEffect(() => {
    if (!onRegisterControl) return;
    onRegisterControl({
      enableCamera: startCamera,
      disableCamera: stopCamera,
      saveClip: handleSaveClip,
      setSentryEnabled,
    });
  }, [onRegisterControl, startCamera, stopCamera, handleSaveClip]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Shared 64x48 lightweight vision loop (~10 fps) while camActive
  useEffect(() => {
    if (!camActive) return;

    const canvas = document.createElement('canvas');
    const W = 64;
    const H = 48;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let prevFrame: Uint8ClampedArray | null = null;
    const waveHistory: Array<{ t: number; x: number }> = [];
    let lastGestureAt = 0;
    let palmStartAt: number | null = null;
    let baselineCenterLum = 120;
    let darkHoldSince: number | null = null;
    let brightHoldSince: number | null = null;
    let lastSentryAt = 0;
    let stillnessSeconds = 0;
    let lastFatigueAt = 0;

    const timer = window.setInterval(() => {
      const videoEl = videoRef.current;
      if (!videoEl || videoEl.readyState < 2) return;

      ctx.drawImage(videoEl, 0, 0, W, H);
      const curr = ctx.getImageData(0, 0, W, H).data;
      const stats = analyzeFrame(curr, prevFrame, W, H);
      prevFrame = new Uint8ClampedArray(curr);

      const now = Date.now();
      setLuxPercent(Math.round((stats.luminance / 255) * 100));
      setMotionPercent(Math.min(100, Math.round(stats.motionPercent)));

      // Slowly adapt baseline center luminance when no palm is covering
      if (stats.centerLuminance > 35) {
        baselineCenterLum = baselineCenterLum * 0.96 + stats.centerLuminance * 0.04;
      }

      // 1. Touchless Hand-Wave & Palm-Hold Gestures
      if (togglesRef.current.gestures && now - lastGestureAt > 1400) {
        // Palm hold: center darkens sharply relative to cabin baseline for ~900ms
        const palmCovered = stats.centerLuminance < Math.min(38, baselineCenterLum * 0.42);
        if (palmCovered) {
          if (palmStartAt === null) palmStartAt = now;
          if (now - palmStartAt >= 900) {
            lastGestureAt = now;
            palmStartAt = null;
            waveHistory.length = 0;
            setLastGestureLabel('Palm Hold → Play/Pause');
            onGestureDetected('palm-hold');
          }
        } else {
          palmStartAt = null;
          if (stats.centroidX !== null && stats.motionPercent > 8) {
            waveHistory.push({ t: now, x: stats.centroidX });
            while (waveHistory.length > 0 && now - waveHistory[0].t > 550) {
              waveHistory.shift();
            }
            if (waveHistory.length >= 3) {
              const dx = waveHistory[waveHistory.length - 1].x - waveHistory[0].x;
              if (Math.abs(dx) >= 0.28) {
                lastGestureAt = now;
                waveHistory.length = 0;
                const gesture: DetectedGesture = dx > 0 ? 'wave-right' : 'wave-left';
                setLastGestureLabel(
                  gesture === 'wave-right' ? 'Wave Right → Next' : 'Wave Left → Prev'
                );
                onGestureDetected(gesture);
              }
            }
          }
        }
      }

      // 2. Auto Night-Dimmer (Ambient Light Sensor with 3s hysteresis)
      if (togglesRef.current.autoDim) {
        if (stats.luminance < 48) {
          brightHoldSince = null;
          if (darkHoldSince === null) darkHoldSince = now;
          if (now - darkHoldSince >= 3000) {
            onAutoNightDim(true);
          }
        } else if (stats.luminance > 72) {
          darkHoldSince = null;
          if (brightHoldSince === null) brightHoldSince = now;
          if (now - brightHoldSince >= 3000) {
            onAutoNightDim(false);
          }
        }
      }

      // 3. Parked Sentry Mode (auto-capture JPEG on cabin motion in Gear P)
      if (
        togglesRef.current.sentry &&
        gearRef.current === 'P' &&
        stats.motionPercent > 14 &&
        now - lastSentryAt > 8000
      ) {
        lastSentryAt = now;
        void captureSentrySnapshot();
      }

      // 4. Driver Fatigue / Motorway Break Alert (prolonged stillness in Gear D)
      if (togglesRef.current.fatigue && gearRef.current === 'D') {
        if (stats.motionPercent < 1.8) {
          stillnessSeconds += 0.1;
          if (stillnessSeconds >= 45 && now - lastFatigueAt > 120000) {
            lastFatigueAt = now;
            stillnessSeconds = 0;
            playFatigueChime();
            onFatigueAlert();
          }
        } else {
          stillnessSeconds = 0;
        }
      } else {
        stillnessSeconds = 0;
      }
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, [camActive, captureSentrySnapshot, onAutoNightDim, onFatigueAlert, onGestureDetected]);

  const handleOpenPreview = (record: CabinCaptureRecord) => {
    if (previewItem) URL.revokeObjectURL(previewItem.url);
    const url = URL.createObjectURL(record.blob);
    setPreviewItem({ record, url });
  };

  const handleClosePreview = () => {
    if (previewItem) URL.revokeObjectURL(previewItem.url);
    setPreviewItem(null);
  };

  const handleDownloadCapture = (record: CabinCaptureRecord) => {
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = record.mimeType.includes('video') ? 'webm' : 'jpg';
    a.download = `qashqai-${record.id}.${ext}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDeleteCapture = async (id: string) => {
    await deleteCabinCapture(id);
    setCaptures((prev) => prev.filter((c) => c.id !== id));
    if (previewItem?.record.id === id) handleClosePreview();
  };

  const filteredCaptures =
    galleryFilter === 'all' ? captures : captures.filter((c) => c.kind === galleryFilter);

  return (
    <div className={visible ? 'flex flex-col gap-2.5 pb-2' : 'hidden'}>
      {/* Live Cabin Mirror & Dashcam Stage */}
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-black/75 backdrop-blur-xl shadow-2xl">
        <div className={`relative w-full bg-zinc-950 ${isCompact ? 'h-40' : 'h-52 sm:h-56'}`}>
          <video
            ref={videoRef}
            muted
            playsInline
            className={`h-full w-full object-cover ${mirrorView ? '-scale-x-100' : ''} ${
              camActive ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {!camActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/15 text-sky-300">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Tablet Front Camera (Cabin Cam)</h3>
                <p className="mt-0.5 max-w-sm text-[11px] text-zinc-400">
                  100% local on-device vision for hand-wave gestures, auto night-dim, dashcam loop
                  recording, parked sentry, and fatigue alerts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition cursor-pointer shadow-lg"
              >
                <Camera className="h-3.5 w-3.5" />
                Enable Cabin Cam
              </button>
              {camError && <p className="text-[11px] text-red-400">{camError}</p>}
            </div>
          )}

          {/* Live HUD Overlays when active */}
          {camActive && (
            <>
              <div className="absolute left-3 top-3 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-black/75 px-2.5 py-1 text-[10px] font-bold text-red-300 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  REC LOOP
                </span>
                {sentryEnabled && gear === 'P' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-200 backdrop-blur-md">
                    <ShieldAlert className="h-3 w-3" />
                    SENTRY ARMED
                  </span>
                )}
              </div>

              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMirrorView((m) => !m)}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur-md transition cursor-pointer ${
                    mirrorView
                      ? 'border-sky-400/40 bg-sky-500/20 text-sky-200'
                      : 'border-white/15 bg-black/65 text-zinc-300'
                  }`}
                  title="Flip Mirror View"
                  aria-label="Flip Mirror View"
                >
                  <FlipHorizontal2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex h-8 items-center gap-1 rounded-xl border border-red-400/35 bg-red-500/20 px-2.5 text-[11px] font-semibold text-red-200 backdrop-blur-md hover:bg-red-500/30 transition cursor-pointer"
                  aria-label="Stop Cabin Cam"
                >
                  <CameraOff className="h-3.5 w-3.5" />
                  <span>Stop</span>
                </button>
              </div>

              {/* Bottom Action Bar inside Preview */}
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] text-zinc-300 backdrop-blur-md">
                  <span>Light {luxPercent}%</span>
                  <span className="text-zinc-600">•</span>
                  <span>Motion {motionPercent}%</span>
                  {lastGestureLabel && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-sky-300 font-semibold">{lastGestureLabel}</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  disabled={savingClip}
                  onClick={() => void handleSaveClip()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg hover:bg-red-500 disabled:opacity-60 transition cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingClip ? 'Saving…' : 'Save Clip'}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {savedToast && (
          <div className="flex items-center justify-center gap-1.5 border-t border-emerald-400/20 bg-emerald-500/15 py-1.5 text-[11px] font-semibold text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            <span>{savedToast}</span>
          </div>
        )}
      </div>

      {/* Smart Cabin Features Toggle Grid */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setGesturesEnabled((v) => !v)}
          className={`flex items-start gap-2.5 rounded-2xl border p-2.5 text-left transition cursor-pointer ${
            gesturesEnabled
              ? 'border-sky-400/35 bg-sky-500/10 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400'
          }`}
        >
          <Hand className={`mt-0.5 h-4 w-4 shrink-0 ${gesturesEnabled ? 'text-sky-400' : 'text-zinc-500'}`} />
          <div className="min-w-0">
            <div className="text-xs font-semibold">Hand-Wave Gestures</div>
            <div className="text-[10px] text-zinc-400 leading-snug">
              Wave L/R = Skip • Palm = Play/Pause
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setAutoDimEnabled((v) => !v)}
          className={`flex items-start gap-2.5 rounded-2xl border p-2.5 text-left transition cursor-pointer ${
            autoDimEnabled
              ? 'border-indigo-400/35 bg-indigo-500/10 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400'
          }`}
        >
          <SunMoon
            className={`mt-0.5 h-4 w-4 shrink-0 ${autoDimEnabled ? 'text-indigo-400' : 'text-zinc-500'}`}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold">Auto Night-Dim</div>
            <div className="text-[10px] text-zinc-400 leading-snug">
              Dims automatically in tunnels/night
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSentryEnabled((v) => !v)}
          className={`flex items-start gap-2.5 rounded-2xl border p-2.5 text-left transition cursor-pointer ${
            sentryEnabled
              ? 'border-amber-400/35 bg-amber-500/10 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400'
          }`}
        >
          <ShieldAlert
            className={`mt-0.5 h-4 w-4 shrink-0 ${sentryEnabled ? 'text-amber-400' : 'text-zinc-500'}`}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold">Parked Sentry</div>
            <div className="text-[10px] text-zinc-400 leading-snug">
              Auto-snapshots cabin motion in P
            </div>
          </div>
        </button>

        <div
          className={`flex items-start justify-between gap-2 rounded-2xl border p-2.5 transition ${
            fatigueEnabled
              ? 'border-emerald-400/35 bg-emerald-500/10 text-white'
              : 'border-white/10 bg-black/55 text-zinc-400'
          }`}
        >
          <button
            type="button"
            onClick={() => setFatigueEnabled((v) => !v)}
            className="flex items-start gap-2 text-left cursor-pointer min-w-0"
          >
            <Coffee
              className={`mt-0.5 h-4 w-4 shrink-0 ${fatigueEnabled ? 'text-emerald-400' : 'text-zinc-500'}`}
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold">Fatigue Alert</div>
              <div className="text-[10px] text-zinc-400 leading-snug">Motorway break chime</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              playFatigueChime();
              onFatigueAlert();
            }}
            className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-200 hover:bg-white/20 cursor-pointer"
            title="Test Fatigue Alert"
          >
            Test
          </button>
        </div>
      </div>

      {/* Saved Dashcam Clips & Sentry Gallery */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-xs font-semibold text-white">
              Saved Clips & Sentry ({captures.length})
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'dashcam-clip', label: 'Clips' },
                { key: 'sentry-snapshot', label: 'Sentry' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setGalleryFilter(f.key)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                  galleryFilter === f.key ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredCaptures.length === 0 ? (
          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 py-4 text-[11px] text-zinc-500">
            <Sparkles className="h-3.5 w-3.5" />
            <span>No saved clips or sentry snapshots yet.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {filteredCaptures.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2"
              >
                <button
                  type="button"
                  onClick={() => handleOpenPreview(rec)}
                  className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      rec.kind === 'dashcam-clip'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {rec.kind === 'dashcam-clip' ? (
                      <Play className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-white">{rec.label}</div>
                    <div className="text-[10px] text-zinc-400">
                      {formatStamp(rec.createdAt)} • {formatBytes(rec.sizeBytes)}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadCapture(rec)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-zinc-200 hover:bg-white/20 cursor-pointer"
                    title="Download"
                    aria-label="Download capture"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCapture(rec.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 cursor-pointer"
                    title="Delete"
                    aria-label="Delete capture"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="text-xs font-semibold text-white">{previewItem.record.label}</span>
              <button
                type="button"
                onClick={handleClosePreview}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-200 hover:bg-white/20 cursor-pointer"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-black">
              {previewItem.record.mimeType.includes('video') ? (
                <video src={previewItem.url} controls autoPlay className="max-h-[70vh] w-full" />
              ) : (
                <img
                  src={previewItem.url}
                  alt={previewItem.record.label}
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
