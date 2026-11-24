import React, { useState } from 'react';
import {
  ExternalLink,
  Plus,
  Trash2,
  Maximize2,
  X,
  Music2,
  Tv,
} from 'lucide-react';
import {
  DEFAULT_SPOTIFY_PRESETS,
  DEFAULT_YOUTUBE_PRESETS,
  type SpotifyPreset,
  type YouTubePreset,
} from '../data/qashqaiData';

const SPOTIFY_STORAGE_KEY = 'qashqai_custom_spotify_v1';
const YOUTUBE_STORAGE_KEY = 'qashqai_custom_youtube_v1';

function parseSpotifyUrl(input: string): { embedType: 'playlist' | 'album' | 'track'; spotifyId: string } | null {
  const match = input.match(/spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track)\/([a-zA-Z0-9]+)/i);
  if (match) {
    return {
      embedType: match[1].toLowerCase() as 'playlist' | 'album' | 'track',
      spotifyId: match[2],
    };
  }
  const uriMatch = input.match(/spotify:(playlist|album|track):([a-zA-Z0-9]+)/i);
  if (uriMatch) {
    return {
      embedType: uriMatch[1].toLowerCase() as 'playlist' | 'album' | 'track',
      spotifyId: uriMatch[2],
    };
  }
  return null;
}

function parseYouTubeUrl(input: string): { videoId?: string; playlistId?: string } | null {
  const trimmed = input.trim();
  const listMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  const vMatch =
    trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
    trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
    trimmed.match(/youtube\.com\/(?:embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);

  if (vMatch) {
    return { videoId: vMatch[1], playlistId: listMatch?.[1] };
  }
  if (listMatch) {
    return { playlistId: listMatch[1] };
  }
  return null;
}

interface StreamingAppsPanelProps {
  mode: 'spotify' | 'youtube';
  isCompact?: boolean;
  onStopRadio?: () => void;
}

export const StreamingAppsPanel: React.FC<StreamingAppsPanelProps> = ({
  mode,
  isCompact = false,
  onStopRadio,
}) => {
  // Spotify state
  const [customSpotify, setCustomSpotify] = useState<SpotifyPreset[]>(() => {
    try {
      const raw = localStorage.getItem(SPOTIFY_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SpotifyPreset[]) : [];
    } catch {
      return [];
    }
  });
  const [activeSpotify, setActiveSpotify] = useState<SpotifyPreset>(DEFAULT_SPOTIFY_PRESETS[0]);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [spotifyName, setSpotifyName] = useState('');
  const [spotifyErr, setSpotifyErr] = useState<string | null>(null);

  // YouTube state
  const [customYouTube, setCustomYouTube] = useState<YouTubePreset[]>(() => {
    try {
      const raw = localStorage.getItem(YOUTUBE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as YouTubePreset[]) : [];
    } catch {
      return [];
    }
  });
  const [activeYouTube, setActiveYouTube] = useState<YouTubePreset>(DEFAULT_YOUTUBE_PRESETS[0]);
  const [youtubeUrl, setTvUrl] = useState('');
  const [youtubeName, setTvName] = useState('');
  const [youtubeErr, setTvErr] = useState<string | null>(null);
  const [ytFullscreen, setYtFullscreen] = useState(false);

  const allSpotify = [...customSpotify, ...DEFAULT_SPOTIFY_PRESETS];
  const allYouTube = [...customYouTube, ...DEFAULT_YOUTUBE_PRESETS];

  const handleAddSpotify = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSpotifyUrl(spotifyUrl);
    if (!parsed) {
      setSpotifyErr('Paste a valid Spotify playlist, album, or track URL.');
      return;
    }
    setSpotifyErr(null);
    const nextItem: SpotifyPreset = {
      id: `sp-custom-${Date.now()}`,
      name: spotifyName.trim() || `My ${parsed.embedType}`,
      subtitle: 'Saved Spotify Link',
      embedType: parsed.embedType,
      spotifyId: parsed.spotifyId,
      custom: true,
    };
    const updated = [nextItem, ...customSpotify];
    setCustomSpotify(updated);
    setActiveSpotify(nextItem);
    onStopRadio?.();
    setSpotifyUrl('');
    setSpotifyName('');
    try {
      localStorage.setItem(SPOTIFY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleDeleteSpotify = (id: string) => {
    const updated = customSpotify.filter((p) => p.id !== id);
    setCustomSpotify(updated);
    if (activeSpotify.id === id) setActiveSpotify(DEFAULT_SPOTIFY_PRESETS[0]);
    try {
      localStorage.setItem(SPOTIFY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleAddYouTube = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseYouTubeUrl(youtubeUrl);
    if (!parsed) {
      setTvErr('Paste a valid YouTube video, live stream, or playlist URL.');
      return;
    }
    setTvErr(null);
    const nextItem: YouTubePreset = {
      id: `yt-custom-${Date.now()}`,
      name: youtubeName.trim() || (parsed.playlistId && !parsed.videoId ? 'My Playlist' : 'Saved Video'),
      subtitle: 'Saved YouTube Link',
      videoId: parsed.videoId,
      playlistId: parsed.playlistId,
      custom: true,
    };
    const updated = [nextItem, ...customYouTube];
    setCustomYouTube(updated);
    setActiveYouTube(nextItem);
    onStopRadio?.();
    setTvUrl('');
    setTvName('');
    try {
      localStorage.setItem(YOUTUBE_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleDeleteYouTube = (id: string) => {
    const updated = customYouTube.filter((p) => p.id !== id);
    setCustomYouTube(updated);
    if (activeYouTube.id === id) setActiveYouTube(DEFAULT_YOUTUBE_PRESETS[0]);
    try {
      localStorage.setItem(YOUTUBE_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  if (mode === 'spotify') {
    const embedSrc = `https://open.spotify.com/embed/${activeSpotify.embedType}/${activeSpotify.spotifyId}?utm_source=generator&theme=0`;
    const openUrl = `https://open.spotify.com/${activeSpotify.embedType}/${activeSpotify.spotifyId}`;

    return (
      <div className="flex flex-col gap-2.5">
        {/* Header + 1-tap Native App Launcher */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#1DB954]/20 text-[#1DB954]">
              <Music2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">{activeSpotify.name}</div>
              <div className="truncate text-[10px] text-zinc-400">{activeSpotify.subtitle}</div>
            </div>
          </div>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onStopRadio?.()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1DB954] px-3 py-1.5 text-[11px] font-bold text-black hover:bg-[#1ed760] transition"
          >
            <span>Open Spotify App</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Preset & Saved Playlist Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {allSpotify.map((item) => {
            const selected = activeSpotify.id === item.id;
            return (
              <div key={item.id} className="inline-flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSpotify(item);
                    onStopRadio?.();
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    selected
                      ? 'border-[#1DB954]/60 bg-[#1DB954]/20 text-[#1ed760]'
                      : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:text-white'
                  } ${item.custom ? 'rounded-r-none border-r-0' : ''}`}
                >
                  {item.name}
                </button>
                {item.custom && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSpotify(item.id)}
                    className="rounded-r-full border border-white/10 bg-white/[0.04] px-1.5 py-1 text-zinc-400 hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Embedded Dark Spotify Player */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
          <iframe
            title="Spotify Player"
            src={embedSrc}
            width="100%"
            height={isCompact ? 152 : 232}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="border-0"
          />
        </div>

        {/* Add Custom Spotify Playlist / Album / Track */}
        <form onSubmit={handleAddSpotify} className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value={spotifyName}
            onChange={(e) => setSpotifyName(e.target.value)}
            placeholder="Label (optional)"
            className="w-28 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#1DB954]/50"
          />
          <input
            type="text"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            placeholder="Paste Spotify playlist/album link..."
            className="flex-1 min-w-[160px] rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#1DB954]/50"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Save</span>
          </button>
        </form>
        {spotifyErr && <p className="text-[11px] text-red-400">{spotifyErr}</p>}
      </div>
    );
  }

  // YouTube mode
  const ytEmbedSrc = activeYouTube.videoId
    ? `https://www.youtube.com/embed/${activeYouTube.videoId}?rel=0${
        activeYouTube.playlistId ? `&list=${encodeURIComponent(activeYouTube.playlistId)}` : ''
      }`
    : `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(
        activeYouTube.playlistId ?? ''
      )}`;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header + App Launchers + Fullscreen */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-400">
            <Tv className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-white">{activeYouTube.name}</div>
            <div className="truncate text-[10px] text-zinc-400">{activeYouTube.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setYtFullscreen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-zinc-200 hover:bg-white/15 cursor-pointer"
            title="Fullscreen YouTube"
            aria-label="Fullscreen YouTube"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <a
            href="https://music.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onStopRadio?.()}
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.08] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 transition"
          >
            <span>YT Music</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onStopRadio?.()}
            className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-500 transition"
          >
            <span>YouTube</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Preset & Saved YouTube Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {allYouTube.map((item) => {
          const selected = activeYouTube.id === item.id;
          return (
            <div key={item.id} className="inline-flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveYouTube(item);
                  onStopRadio?.();
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  selected
                    ? 'border-red-500/60 bg-red-500/20 text-red-200'
                    : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:text-white'
                } ${item.custom ? 'rounded-r-none border-r-0' : ''}`}
              >
                {item.name}
              </button>
              {item.custom && (
                <button
                  type="button"
                  onClick={() => handleDeleteYouTube(item.id)}
                  className="rounded-r-full border border-white/10 bg-white/[0.04] px-1.5 py-1 text-zinc-400 hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Embedded YouTube Player */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black ${
          isCompact ? 'h-40' : 'h-52 sm:h-56'
        }`}
      >
        <iframe
          title="YouTube Player"
          src={ytEmbedSrc}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>

      {/* Play / Save Custom YouTube URL */}
      <form onSubmit={handleAddYouTube} className="flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          value={youtubeName}
          onChange={(e) => setTvName(e.target.value)}
          placeholder="Label (optional)"
          className="w-28 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-red-400/50"
        />
        <input
          type="text"
          value={youtubeUrl}
          onChange={(e) => setTvUrl(e.target.value)}
          placeholder="Paste YouTube video or playlist link..."
          className="flex-1 min-w-[160px] rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-red-400/50"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Play & Save</span>
        </button>
      </form>
      {youtubeErr && <p className="text-[11px] text-red-400">{youtubeErr}</p>}

      {/* Fullscreen YouTube Overlay */}
      {ytFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-md">
          <div className="mb-3 flex w-full max-w-5xl items-center justify-between">
            <span className="truncate text-sm font-semibold text-white">{activeYouTube.name}</span>
            <button
              type="button"
              onClick={() => setYtFullscreen(false)}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
          <div className="h-[78vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            <iframe
              title="YouTube Fullscreen Player"
              src={ytEmbedSrc}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
};
