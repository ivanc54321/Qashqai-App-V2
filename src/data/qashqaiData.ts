export interface RadioStation {
  id: string;
  name: string;
  shortName: string;
  subtitle: string;
  gradient: string;
  streams: string[];
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'kiss',
    name: 'KISS FM',
    shortName: 'KISS',
    subtitle: '100 FM • UK Live',
    gradient: 'from-pink-500 via-fuchsia-600 to-purple-800',
    streams: [
      'https://stream-al.planetradio.co.uk/kissnational.aac',
      'https://stream-mz.planetradio.co.uk/kissnational.aac',
      'https://edge-bauerall-01-gos2.sharp-stream.com/kissnational.mp3',
      'https://edge-bauerall-01-gos2.sharp-stream.com/kissnational.aac',
    ],
  },
  {
    id: 'kisstory',
    name: 'KISSTORY',
    shortName: 'KISS\nTORY',
    subtitle: 'Old Skool & Anthems',
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
    gradient: 'from-cyan-500 via-sky-600 to-blue-900',
    streams: [
      'https://stream-al.planetradio.co.uk/kissfresh.aac',
      'https://edge-bauerall-01-gos2.sharp-stream.com/kissfresh.aac',
    ],
  },
  {
    id: 'heart-kent',
    name: 'Heart Kent',
    shortName: 'HEART',
    subtitle: '102.8 / 96.1 FM • Kent',
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
    gradient: 'from-zinc-600 via-zinc-800 to-black',
    streams: [
      'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one',
    ],
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
