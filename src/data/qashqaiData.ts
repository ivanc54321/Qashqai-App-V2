export type StationCategory = 'urban' | 'mainstream';

export interface RadioStation {
  id: string;
  name: string;
  shortName: string;
  subtitle: string;
  category: StationCategory;
  gradient: string;
  streams: string[];
}

export const RADIO_STATIONS: RadioStation[] = [
  // Urban, Hip-Hop, Grime, R&B & UK Beats
  {
    id: 'kiss',
    name: 'KISS FM',
    shortName: 'KISS',
    subtitle: '100 FM • UK Live',
    category: 'urban',
    gradient: 'from-pink-500 via-fuchsia-600 to-purple-800',
    streams: [
      'https://stream-al.planetradio.co.uk/kissnational.aac',
      'https://stream-mz.planetradio.co.uk/kissnational.aac',
      'https://edge-bauerall-01-gos2.sharp-stream.com/kissnational.mp3',
      'https://edge-bauerall-01-gos2.sharp-stream.com/kissnational.aac',
    ],
  },
  {
    id: '1xtra',
    name: 'BBC Radio 1Xtra',
    shortName: '1XTRA',
    subtitle: 'UK Hip-Hop, Grime & Afrobeats',
    category: 'urban',
    gradient: 'from-zinc-800 via-neutral-900 to-black',
    streams: [
      'https://stream.live.vc.bbcmedia.co.uk/bbc_1xtra',
      'https://as-hls-ww-live.akamaized.net/pool_92079267/live/ww/bbc_1xtra/bbc_1xtra.isml/bbc_1xtra-audio%3d128000.norewind.m3u8',
    ],
  },
  {
    id: 'capital-xtra',
    name: 'Capital XTRA',
    shortName: 'XTRA',
    subtitle: 'Hip-Hop & R&B • London',
    category: 'urban',
    gradient: 'from-emerald-500 via-teal-600 to-zinc-900',
    streams: [
      'https://media-the.musicradio.com/CapitalXTRALondonMP3',
      'https://media-ice.musicradio.com/CapitalXTRANationalMP3',
      'https://media-ssl.musicradio.com/CapitalXTRALondonMP3',
    ],
  },
  {
    id: 'capital-xtra-reloaded',
    name: 'Capital XTRA Reloaded',
    shortName: 'RELOAD',
    subtitle: 'Old Skool Hip-Hop & R&B',
    category: 'urban',
    gradient: 'from-amber-500 via-orange-600 to-zinc-900',
    streams: [
      'https://media-ice.musicradio.com/CapitalXTRAReloadedMP3',
      'https://media-ssl.musicradio.com/CapitalXTRAReloadedMP3',
    ],
  },
  {
    id: 'kisstory',
    name: 'KISSTORY',
    shortName: 'KISS\nTORY',
    subtitle: 'Old Skool & Anthems',
    category: 'urban',
    gradient: 'from-violet-500 via-purple-600 to-indigo-900',
    streams: [
      'https://stream-al.planetradio.co.uk/kisstory.aac',
      'https://stream-mz.planetradio.co.uk/kisstory.aac',
      'https://edge-bauerall-01-gos2.sharp-stream.com/kisstory.aac',
    ],
  },
  {
    id: 'kissfresh',
    name: 'KISS Fresh',
    shortName: 'FRESH',
    subtitle: 'Non-Stop New Beats',
    category: 'urban',
    gradient: 'from-cyan-500 via-sky-600 to-blue-900',
    streams: [
      'https://stream-al.planetradio.co.uk/kissfresh.aac',
      'https://edge-bauerall-01-gos2.sharp-stream.com/kissfresh.aac',
    ],
  },
  {
    id: 'rinse-fm',
    name: 'Rinse FM',
    shortName: 'RINSE',
    subtitle: '106.8 FM • London Underground',
    category: 'urban',
    gradient: 'from-slate-600 via-zinc-800 to-black',
    streams: ['https://admin.stream.rinse.fm/proxy/rinse_uk/stream'],
  },
  {
    id: 'mi-soul',
    name: 'Mi-Soul',
    shortName: 'MI-SOUL',
    subtitle: 'Soul, R&B & House • London',
    category: 'urban',
    gradient: 'from-orange-500 via-rose-600 to-purple-950',
    streams: ['https://listen-misoul.sharp-stream.com/462_mi_soul_128_mp3'],
  },
  {
    id: 'reprezent',
    name: 'Reprezent 107.3',
    shortName: '107.3',
    subtitle: 'South London • UK Rap & Drill',
    category: 'urban',
    gradient: 'from-yellow-500 via-amber-600 to-zinc-900',
    streams: ['https://radio.canstream.co.uk:8022/live.mp3'],
  },
  // Mainstream UK Hits
  {
    id: 'capital-fm',
    name: 'Capital FM',
    shortName: 'CAPITAL',
    subtitle: 'UK No.1 Hit Music',
    category: 'mainstream',
    gradient: 'from-blue-500 via-indigo-600 to-blue-950',
    streams: [
      'https://media-ice.musicradio.com/CapitalMP3',
      'https://media-ssl.musicradio.com/CapitalMP3',
    ],
  },
  {
    id: 'heart-kent',
    name: 'Heart Kent',
    shortName: 'HEART',
    subtitle: '102.8 / 96.1 FM • Kent',
    category: 'mainstream',
    gradient: 'from-rose-500 via-red-600 to-rose-950',
    streams: [
      'https://media-ice.musicradio.com/HeartKentMP3',
      'https://media-ssl.musicradio.com/HeartKentMP3',
    ],
  },
  {
    id: 'bbc-r1',
    name: 'BBC Radio 1',
    shortName: 'R1',
    subtitle: 'UK National • Live',
    category: 'mainstream',
    gradient: 'from-zinc-600 via-zinc-800 to-black',
    streams: ['https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one'],
  },
  {
    id: 'bbc-r2',
    name: 'BBC Radio 2',
    shortName: 'R2',
    subtitle: 'UK Mainstream & Classics',
    category: 'mainstream',
    gradient: 'from-orange-400 via-amber-600 to-orange-950',
    streams: [
      'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_two',
      'https://as-hls-ww-live.akamaized.net/pool_74208725/live/ww/bbc_radio_two/bbc_radio_two.isml/bbc_radio_two-audio%3d128000.norewind.m3u8',
    ],
  },
];

export interface SpotifyPreset {
  id: string;
  name: string;
  subtitle: string;
  embedType: 'playlist' | 'album' | 'track';
  spotifyId: string;
  custom?: boolean;
}

export const DEFAULT_SPOTIFY_PRESETS: SpotifyPreset[] = [
  {
    id: 'sp-who-we-be',
    name: 'Who We Be',
    subtitle: 'UK Rap, Grime & Afrobeats',
    embedType: 'playlist',
    spotifyId: '37i9dQZF1DXc8kgYqQLMfH',
  },
  {
    id: 'sp-rapcaviar',
    name: 'RapCaviar',
    subtitle: 'Hip-Hop & Rap Hits',
    embedType: 'playlist',
    spotifyId: '37i9dQZF1DX0XUsuxWHRQd',
  },
  {
    id: 'sp-90s-hiphop',
    name: "90s Hip-Hop",
    subtitle: 'Old Skool Classics',
    embedType: 'playlist',
    spotifyId: '37i9dQZF1DX186v583rmzp',
  },
  {
    id: 'sp-rnb',
    name: 'R&B Weekly',
    subtitle: 'Smooth Night Drive',
    embedType: 'playlist',
    spotifyId: '37i9dQZF1DX4SBhb3fqCJd',
  },
  {
    id: 'sp-top-hits',
    name: "Today's Top Hits",
    subtitle: 'Mainstream Chart',
    embedType: 'playlist',
    spotifyId: '37i9dQZF1DXcBWIGoYBM5M',
  },
];

export interface YouTubePreset {
  id: string;
  name: string;
  subtitle: string;
  videoId?: string;
  playlistId?: string;
  custom?: boolean;
}

export const DEFAULT_YOUTUBE_PRESETS: YouTubePreset[] = [
  {
    id: 'yt-hiphop-247',
    name: 'Hip-Hop & Chill 24/7',
    subtitle: 'Live Urban Beats Stream',
    videoId: '5yx6BWlEVcY',
  },
  {
    id: 'yt-lofi-drive',
    name: 'Lofi Girl Radio',
    subtitle: 'Beats to Drive / Relax',
    videoId: 'jfKfPfyJRdk',
  },
  {
    id: 'yt-night-drive',
    name: 'Night Drive Synth',
    subtitle: 'Late Night Motorway',
    videoId: '4xDzrJKXOOY',
  },
  {
    id: 'yt-rnb-vibes',
    name: 'Smooth R&B Mix',
    subtitle: 'Soul & Chill Vibes',
    videoId: 'kgx4WGK0oNU',
  },
];

export interface NavDestination {
  name: string;
  address: string;
  query: string;
  eta: string;
  distance: string;
  speedLimit: number;
}

export const DESTINATIONS: NavDestination[] = [
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

export interface MaintenanceItem {
  id: string;
  title: string;
  detail: string;
  dueLabel: string;
  status: 'ok' | 'soon' | 'due';
  lastDone?: string;
}

export const DEFAULT_MAINTENANCE_ITEMS: MaintenanceItem[] = [
  {
    id: 'oil',
    title: 'Oil & Filter (5W-30 C4 Low SAPS)',
    detail: 'Critical for J10 dCi DPF longevity • Every 10k mi / 12 mo',
    dueLabel: 'In 2,400 mi',
    status: 'ok',
  },
  {
    id: 'dpf',
    title: 'DPF Motorway Regen Run',
    detail: '20+ min @ >2,000 RPM to clear soot from short Kent trips',
    dueLabel: 'Recommended',
    status: 'soon',
  },
  {
    id: 'bushes',
    title: 'Rear Suspension Bushes & Shocks',
    detail: 'Common 2012 J10 wear item — check for rear knocks',
    dueLabel: 'Inspected OK',
    status: 'ok',
  },
  {
    id: 'timing',
    title: 'Timing Belt & Water Pump',
    detail: '1.5 dCi (K9K) interval: 72,000 mi or 5 years',
    dueLabel: 'Check Log',
    status: 'soon',
  },
];

export const QASHQAI_GLOVEBOX_SPECS = [
  { label: 'Model', value: '2012 Qashqai J10 (WG62 HJC)' },
  { label: 'Engine / Oil', value: 'Diesel • 5W-30 ACEA C4' },
  { label: 'Tyres (Normal)', value: '33 PSI Front / 30 PSI Rear' },
  { label: 'Tyres (Loaded)', value: '36 PSI Front / 38 PSI Rear' },
  { label: 'Headlight Bulb', value: 'H7 Dipped / H7 Main' },
  { label: 'Wheel Nut Torque', value: '113 Nm (83 lb-ft)' },
];
