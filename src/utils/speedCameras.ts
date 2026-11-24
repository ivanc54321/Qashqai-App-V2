export interface SpeedCamera {
  id: string;
  lat: number;
  lon: number;
  name: string;
  maxspeed?: number;
}

// Built-in East Kent / Thanet fallback cameras (works even offline)
export const KENT_FALLBACK_CAMERAS: SpeedCamera[] = [
  { id: 'kent-1', lat: 51.3635, lon: 1.3895, name: 'A254 Margate Road', maxspeed: 30 },
  { id: 'kent-2', lat: 51.3512, lon: 1.3652, name: 'A299 Hengist Way', maxspeed: 50 },
  { id: 'kent-3', lat: 51.3458, lon: 1.3185, name: 'A299 Thanet Way', maxspeed: 70 },
  { id: 'kent-4', lat: 51.3818, lon: 1.3812, name: 'A28 Canterbury Road, Margate', maxspeed: 30 },
];

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchNearbySpeedCameras(lat: number, lon: number): Promise<SpeedCamera[]> {
  try {
    const query = `[out:json][timeout:6];node["highway"="speed_camera"](around:6000,${lat},${lon});out body;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });
    if (!res.ok) return KENT_FALLBACK_CAMERAS;
    const data = (await res.json()) as {
      elements?: Array<{ id: number; lat: number; lon: number; tags?: Record<string, string> }>;
    };
    const parsed: SpeedCamera[] = (data.elements || []).map((el) => ({
      id: `osm-${el.id}`,
      lat: el.lat,
      lon: el.lon,
      name: el.tags?.name || el.tags?.ref || 'Fixed Speed Camera',
      maxspeed: el.tags?.maxspeed ? parseInt(el.tags.maxspeed, 10) || undefined : undefined,
    }));
    return parsed.length > 0 ? parsed : KENT_FALLBACK_CAMERAS;
  } catch {
    return KENT_FALLBACK_CAMERAS;
  }
}

export function playSpeedCameraChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Ignore audio context errors if not user-initiated
  }
}
