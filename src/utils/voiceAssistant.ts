import type { CarHotspotState } from '../components/CarScene';
import type { TabKey } from '../components/MenuStrip';
import type { SpeedCamera } from './speedCameras';
import { RADIO_STATIONS } from '../data/qashqaiData';

export type AssistantGear = 'P' | 'R' | 'N' | 'D';
export type AssistantDriveMode = 'Eco' | 'Comfort' | 'Sport';

export interface AssistantContext {
  speedMph: number;
  speedLimit: number;
  gear: AssistantGear;
  driveMode: AssistantDriveMode;
  driverTemp: number;
  passengerTemp: number;
  volume: number;
  isAudioPlaying: boolean;
  nowPlayingLabel: string;
  hotspotState: CarHotspotState;
  nightDim: boolean;
  nearestCamera: { camera: SpeedCamera; meters: number } | null;
  hasParkedPin: boolean;
}

export interface AssistantActions {
  navigateTo: (query: string, label?: string) => void;
  playRadioStation: (stationId: string) => void;
  togglePlayback: (mode: 'play' | 'pause' | 'toggle') => void;
  setVolume: (vol: number) => void;
  setDriverTemp: (temp: number) => void;
  setPassengerTemp: (temp: number) => void;
  setSeatHeat: (side: 'driver' | 'passenger' | 'both', on: boolean) => void;
  setHotspot: (key: keyof CarHotspotState, on: boolean) => void;
  setGear: (gear: AssistantGear) => void;
  setDriveMode: (mode: AssistantDriveMode) => void;
  setNightDim: (on: boolean) => void;
  selectTab: (tab: TabKey) => void;
  saveParkedPin: () => void;
  showParkedPin: () => void;
  saveDashcamClip?: () => void;
  setSentryMode?: (enabled: boolean) => void;
  openMediaMode?: (mode: 'radio' | 'spotify' | 'youtube' | 'music' | 'videos') => void;
}

export interface AssistantResponse {
  reply: string;
  source: 'offline' | 'gemini';
  actionBadge?: string;
}

export const GEMINI_KEY_STORAGE = 'qashqai_gemini_api_key';
export const WAKE_WORD_STORAGE = 'qashqai_wake_word_enabled';

const clampTemp = (t: number) => Math.max(16, Math.min(28, Number(t.toFixed(1))));

const stripWakeWord = (raw: string) =>
  raw
    .trim()
    .replace(/^(hey|ok|okay|hi)\s+(qashqai|cash cow|google|assistant|car)[,!\s]*/i, '')
    .replace(/^qashqai[,!\s]*/i, '')
    .trim();

export function speakReply(
  text: string,
  callbacks?: { onStart?: () => void; onEnd?: () => void }
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 1.02;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const ukVoice =
      voices.find((v) => /en[-_]GB/i.test(v.lang) && /google|female|serena|martha|daniel/i.test(v.name)) ||
      voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (ukVoice) utterance.voice = ukVoice;

    utterance.onstart = () => callbacks?.onStart?.();
    utterance.onend = () => callbacks?.onEnd?.();
    utterance.onerror = () => callbacks?.onEnd?.();

    window.speechSynthesis.speak(utterance);
  } catch {
    callbacks?.onEnd?.();
  }
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis errors
    }
  }
}

async function queryGeminiFallback(
  transcript: string,
  ctx: AssistantContext,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const systemInstruction = `You are Qashqai AI, a concise British English in-car voice assistant inside a 2012 Nissan Qashqai J10 Diesel (WG62 HJC). Keep every answer under 2 short spoken sentences so the driver stays focused on the road. Current vehicle status: ${ctx.speedMph} mph, gear ${ctx.gear}, ${ctx.driveMode} mode, climate ${ctx.driverTemp}°C / ${ctx.passengerTemp}°C, audio "${ctx.nowPlayingLabel}".`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: transcript }] }],
      generationConfig: { maxOutputTokens: 120, temperature: 0.5 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!answer) throw new Error('Empty Gemini response');
  return answer.replace(/\*/g, '');
}

export async function processVoiceCommand(
  rawTranscript: string,
  ctx: AssistantContext,
  actions: AssistantActions
): Promise<AssistantResponse> {
  const cleaned = stripWakeWord(rawTranscript);
  const lower = cleaned.toLowerCase();

  if (!cleaned) {
    return {
      reply: 'Yes, I am listening. Try saying Play KISS FM, Navigate to Westwood Cross, or Sport mode.',
      source: 'offline',
    };
  }

  // 1. Parking Pin
  if (/(where did i park|find my car|show parked|parked location)/i.test(lower)) {
    if (ctx.hasParkedPin) {
      actions.showParkedPin();
      return {
        reply: 'Showing your parked Qashqai pin on the map.',
        source: 'offline',
        actionBadge: 'Parked Pin',
      };
    }
    return {
      reply: 'No parked location is saved yet. Shift into Park or say Save parking spot.',
      source: 'offline',
    };
  }
  if (/(save park|remember.*park|pin.*park)/i.test(lower)) {
    actions.saveParkedPin();
    return {
      reply: 'Saved your current parking spot.',
      source: 'offline',
      actionBadge: 'Pin Saved',
    };
  }

  // 2. Navigation
  const navMatch = cleaned.match(
    /^(?:navigate to|take me to|directions to|drive to|route to|go to|find|search for)\s+(.+)$/i
  );
  if (navMatch && navMatch[1]) {
    const destination = navMatch[1].replace(/[.?]+$/, '').trim();
    actions.navigateTo(destination, destination);
    return {
      reply: `Navigating to ${destination}.`,
      source: 'offline',
      actionBadge: `Nav: ${destination}`,
    };
  }

  // 3. Spotify & YouTube
  if (/\bspotify\b/i.test(lower)) {
    actions.selectTab('media');
    actions.openMediaMode?.('spotify');
    return { reply: 'Opening Spotify.', source: 'offline', actionBadge: 'Spotify' };
  }
  if (/\byoutube\b/i.test(lower)) {
    actions.selectTab('media');
    actions.openMediaMode?.('youtube');
    return { reply: 'Opening YouTube.', source: 'offline', actionBadge: 'YouTube' };
  }

  // 4. Radio Stations (13 UK Urban & Mainstream Stations)
  for (const station of RADIO_STATIONS) {
    const stationLower = station.name.toLowerCase();
    const shortId = station.id.replace(/-/g, ' ');
    if (
      lower.includes(stationLower) ||
      lower.includes(shortId) ||
      (station.id === '1xtra' && /\b(1xtra|one extra|1 extra)\b/i.test(lower)) ||
      (station.id === 'capital-xtra-reloaded' && /\breloaded\b/i.test(lower)) ||
      (station.id === 'capital-xtra' && /\b(capital xtra|capital extra)\b/i.test(lower) && !/reloaded/i.test(lower)) ||
      (station.id === 'rinse-fm' && /\brinse\b/i.test(lower)) ||
      (station.id === 'mi-soul' && /\b(mi soul|my soul|mi-soul)\b/i.test(lower)) ||
      (station.id === 'reprezent' && /\b(reprezent|represent|107\.3)\b/i.test(lower)) ||
      (station.id === 'capital-fm' && /\bcapital fm\b/i.test(lower)) ||
      (station.id === 'bbc-r1' && /\b(radio 1|radio one)\b/i.test(lower) && !/xtra|extra/i.test(lower)) ||
      (station.id === 'bbc-r2' && /\b(radio 2|radio two)\b/i.test(lower)) ||
      (station.id === 'heart-kent' && /\bheart\b/i.test(lower))
    ) {
      actions.playRadioStation(station.id);
      return {
        reply: `Tuning to ${station.name}.`,
        source: 'offline',
        actionBadge: station.name,
      };
    }
  }
  if (/\b(play radio|turn on radio|start radio)\b/i.test(lower)) {
    actions.playRadioStation('kiss');
    return {
      reply: 'Playing KISS FM.',
      source: 'offline',
      actionBadge: 'KISS FM',
    };
  }

  // 4. Media Play / Pause / Mute / Volume
  if (/\b(pause|stop)\b.*(music|radio|audio|playback|playing)?/i.test(lower) && !/lights|seat|night/i.test(lower)) {
    if (ctx.isAudioPlaying) actions.togglePlayback('pause');
    return {
      reply: 'Paused audio.',
      source: 'offline',
      actionBadge: 'Paused',
    };
  }
  if (/\b(resume|unpause|play music)\b/i.test(lower)) {
    if (!ctx.isAudioPlaying) actions.togglePlayback('play');
    return {
      reply: `Resuming ${ctx.nowPlayingLabel}.`,
      source: 'offline',
      actionBadge: 'Playing',
    };
  }
  if (/\bunmute\b/i.test(lower)) {
    actions.setVolume(70);
    return { reply: 'Audio unmuted to 70 percent.', source: 'offline', actionBadge: 'Vol 70%' };
  }
  if (/\bmute\b/i.test(lower)) {
    actions.setVolume(0);
    return { reply: 'Audio muted.', source: 'offline', actionBadge: 'Muted' };
  }
  const volSetMatch = lower.match(/volume(?:\s+to)?\s+(\d{1,3})/);
  if (volSetMatch) {
    const nextVol = Math.max(0, Math.min(100, parseInt(volSetMatch[1], 10)));
    actions.setVolume(nextVol);
    return { reply: `Volume set to ${nextVol} percent.`, source: 'offline', actionBadge: `Vol ${nextVol}%` };
  }
  if (/(volume up|louder|turn up.*volume|increase.*volume)/i.test(lower)) {
    const nextVol = Math.min(100, ctx.volume + 15);
    actions.setVolume(nextVol);
    return { reply: `Volume up to ${nextVol} percent.`, source: 'offline', actionBadge: `Vol ${nextVol}%` };
  }
  if (/(volume down|quieter|softer|turn down.*volume|decrease.*volume)/i.test(lower)) {
    const nextVol = Math.max(0, ctx.volume - 15);
    actions.setVolume(nextVol);
    return { reply: `Volume down to ${nextVol} percent.`, source: 'offline', actionBadge: `Vol ${nextVol}%` };
  }

  // 5. Climate & Heated Seats
  if (/(heated seat|seat heat|seat warmer)/i.test(lower)) {
    const turnOff = /\b(off|stop|disable)\b/i.test(lower);
    const side = /passenger/i.test(lower)
      ? 'passenger'
      : /driver/i.test(lower)
        ? 'driver'
        : 'both';
    actions.setSeatHeat(side, !turnOff);
    return {
      reply: `${turnOff ? 'Turned off' : 'Turned on'} ${side === 'both' ? 'both heated seats' : `${side} heated seat`}.`,
      source: 'offline',
      actionBadge: `Seats ${turnOff ? 'Off' : 'On'}`,
    };
  }
  const tempMatch = lower.match(/(?:temp(?:erature)?|climate|heat|ac|air con).*?(\d{2}(?:\.\d)?)/);
  if (tempMatch) {
    const target = clampTemp(parseFloat(tempMatch[1]));
    if (/passenger/i.test(lower)) {
      actions.setPassengerTemp(target);
      return { reply: `Passenger temperature set to ${target} degrees.`, source: 'offline', actionBadge: `${target}°C` };
    }
    actions.setDriverTemp(target);
    actions.setPassengerTemp(target);
    return { reply: `Cabin temperature set to ${target} degrees.`, source: 'offline', actionBadge: `${target}°C` };
  }
  if (/(i'm cold|im cold|warmer|turn up.*heat|hotter)/i.test(lower)) {
    const target = clampTemp(ctx.driverTemp + 1.5);
    actions.setDriverTemp(target);
    actions.setPassengerTemp(target);
    return { reply: `Warming cabin to ${target} degrees.`, source: 'offline', actionBadge: `${target}°C` };
  }
  if (/(i'm hot|im hot|cooler|colder|turn down.*heat)/i.test(lower)) {
    const target = clampTemp(ctx.driverTemp - 1.5);
    actions.setDriverTemp(target);
    actions.setPassengerTemp(target);
    return { reply: `Cooling cabin to ${target} degrees.`, source: 'offline', actionBadge: `${target}°C` };
  }

  // 6. Vehicle Hotspots (Headlights, Doors, Trunk/Boot)
  if (/(headlight|lights)/i.test(lower)) {
    const turnOff = /\b(off|close|disable)\b/i.test(lower);
    actions.setHotspot('headlights', !turnOff);
    return {
      reply: `Headlights turned ${turnOff ? 'off' : 'on'}.`,
      source: 'offline',
      actionBadge: `Lights ${turnOff ? 'Off' : 'On'}`,
    };
  }
  if (/\b(trunk|boot)\b/i.test(lower)) {
    const close = /\b(close|shut)\b/i.test(lower);
    actions.setHotspot('trunkOpen', !close);
    return {
      reply: close ? 'Closing the boot.' : 'Opening the boot.',
      source: 'offline',
      actionBadge: close ? 'Boot Closed' : 'Boot Open',
    };
  }
  if (/\bdoors?\b/i.test(lower)) {
    const close = /\b(close|shut|lock)\b/i.test(lower);
    actions.setHotspot('doorsOpen', !close);
    return {
      reply: close ? 'Closing the doors.' : 'Opening the doors.',
      source: 'offline',
      actionBadge: close ? 'Doors Closed' : 'Doors Open',
    };
  }

  // 7. Drive Mode & Gears
  if (/\bsport\s*mode\b|\bswitch to sport\b/i.test(lower)) {
    actions.setDriveMode('Sport');
    return { reply: 'Switched to Sport mode.', source: 'offline', actionBadge: 'Sport Mode' };
  }
  if (/\beco\s*mode\b|\bswitch to eco\b/i.test(lower)) {
    actions.setDriveMode('Eco');
    return { reply: 'Switched to Eco mode.', source: 'offline', actionBadge: 'Eco Mode' };
  }
  if (/\bcomfort\s*mode\b|\bswitch to comfort\b/i.test(lower)) {
    actions.setDriveMode('Comfort');
    return { reply: 'Switched to Comfort mode.', source: 'offline', actionBadge: 'Comfort Mode' };
  }
  if (/(shift to|put in|select)\s+(park|reverse|neutral|drive)/i.test(lower)) {
    const gearMap: Record<string, AssistantGear> = { park: 'P', reverse: 'R', neutral: 'N', drive: 'D' };
    const matched = lower.match(/(park|reverse|neutral|drive)/i)?.[1].toLowerCase() ?? 'drive';
    const g = gearMap[matched];
    actions.setGear(g);
    return { reply: `Shifted to ${matched}.`, source: 'offline', actionBadge: `Gear ${g}` };
  }

  // 8. Night Dimmer & Tabs
  if (/(night mode|night dim|dim screen|dark screen)/i.test(lower)) {
    const turnOff = /\b(off|disable|bright)\b/i.test(lower);
    actions.setNightDim(!turnOff);
    return {
      reply: turnOff ? 'Night dimmer turned off.' : 'Night dimmer enabled.',
      source: 'offline',
      actionBadge: turnOff ? 'Day Mode' : 'Night Mode',
    };
  }
  if (/(open|show|switch to)\s+(navigation|map|maps)/i.test(lower)) {
    actions.selectTab('navigation');
    return { reply: 'Opening Navigation.', source: 'offline', actionBadge: 'Navigation' };
  }
  if (/(open|show|switch to)\s+(media|radio|music)/i.test(lower)) {
    actions.selectTab('media');
    return { reply: 'Opening Media and Radio.', source: 'offline', actionBadge: 'Media' };
  }
  if (/(open|show|switch to)\s+(overview|car|obd|diagnostics|vehicle)/i.test(lower)) {
    actions.selectTab('overview');
    return { reply: 'Opening Vehicle Overview.', source: 'offline', actionBadge: 'Overview' };
  }
  if (/(who made|about drivesmart|about vian|about this app|open about|founder|ivan clague|vian vision)/i.test(lower)) {
    actions.selectTab('about');
    return {
      reply: 'DriveSmart is made by VIAN VISION, founded by Ivan Clague.',
      source: 'offline',
      actionBadge: 'VIAN VISION',
    };
  }
  if (/(open|show|switch to)\s+(cabin cam|cabin camera|front cam|front camera|dashcam|camera)/i.test(lower)) {
    actions.selectTab('camera');
    return { reply: 'Opening Cabin Cam.', source: 'offline', actionBadge: 'Cabin Cam' };
  }
  if (/(save|record)\s+(dashcam|clip|video|footage)/i.test(lower)) {
    actions.saveDashcamClip?.();
    return { reply: 'Saving dashcam clip to local storage.', source: 'offline', actionBadge: 'Clip Saved' };
  }
  if (/\bsentry\s*mode\b/i.test(lower)) {
    const turnOff = /\b(off|disable|stop)\b/i.test(lower);
    actions.setSentryMode?.(!turnOff);
    return {
      reply: turnOff ? 'Parked Sentry Mode disabled.' : 'Parked Sentry Mode enabled.',
      source: 'offline',
      actionBadge: turnOff ? 'Sentry Off' : 'Sentry On',
    };
  }

  // 9. Speed Cameras, Live Telemetry & 2012 Qashqai J10 Specs
  if (/(speed camera|camera ahead|radar)/i.test(lower)) {
    if (ctx.nearestCamera) {
      const dist =
        ctx.nearestCamera.meters < 1000
          ? `${Math.round(ctx.nearestCamera.meters)} metres`
          : `${(ctx.nearestCamera.meters / 1609.34).toFixed(1)} miles`;
      const camLimit = ctx.nearestCamera.camera.maxspeed ?? ctx.speedLimit;
      return {
        reply: `Nearest speed camera is ${dist} away on ${ctx.nearestCamera.camera.name}, ${camLimit} miles per hour limit.`,
        source: 'offline',
        actionBadge: `${camLimit} MPH Cam`,
      };
    }
    return { reply: 'No speed cameras detected nearby.', source: 'offline' };
  }
  if (/(my speed|how fast|speed limit)/i.test(lower)) {
    return {
      reply: `You are doing ${ctx.speedMph} miles per hour. The current limit is ${ctx.speedLimit}.`,
      source: 'offline',
      actionBadge: `${ctx.speedMph} mph`,
    };
  }
  if (/(tyre|tire)\s*pressure/i.test(lower)) {
    return {
      reply: 'For your 2012 Qashqai J10, normal tyre pressure is 33 PSI front and 30 rear, or 36 front and 38 rear when fully loaded.',
      source: 'offline',
      actionBadge: '33 / 30 PSI',
    };
  }
  if (/\b(oil|engine oil)\b/i.test(lower)) {
    return {
      reply: 'Your 2012 Qashqai Diesel takes 5W-30 ACEA C4 low-SAPS oil to protect the DPF.',
      source: 'offline',
      actionBadge: '5W-30 C4',
    };
  }
  if (/\b(wheel|lug|nut)\s*torque\b/i.test(lower)) {
    return {
      reply: 'Wheel nut torque for the Qashqai J10 is 113 Newton metres.',
      source: 'offline',
      actionBadge: '113 Nm',
    };
  }
  if (/\bmot\b/i.test(lower)) {
    return {
      reply: 'Your MOT for WG62 HJC expires on 18 October 2026.',
      source: 'offline',
      actionBadge: 'MOT Oct 2026',
    };
  }
  if (/(what time|current time|time is it)/i.test(lower)) {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return { reply: `It is ${now}.`, source: 'offline', actionBadge: now };
  }

  // 10. Optional Gemini Cloud AI Fallback for open-ended questions
  const apiKey =
    typeof window !== 'undefined' ? window.localStorage.getItem(GEMINI_KEY_STORAGE)?.trim() : '';
  if (apiKey) {
    try {
      const answer = await queryGeminiFallback(cleaned, ctx, apiKey);
      return { reply: answer, source: 'gemini', actionBadge: 'Gemini AI' };
    } catch {
      return {
        reply: 'I could not reach Gemini right now. Check your internet connection or API key in Assistant settings.',
        source: 'offline',
      };
    }
  }

  return {
    reply: `I didn't recognise "${cleaned}". Try "Play KISS FM", "Navigate to Margate", "Set temp to 20", or add a Gemini API key in the gear icon for general AI chat.`,
    source: 'offline',
  };
}
