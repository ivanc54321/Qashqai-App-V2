import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Settings,
  X,
  Send,
  Volume2,
  Check,
  Radio,
} from 'lucide-react';
import {
  processVoiceCommand,
  speakReply,
  stopSpeaking,
  GEMINI_KEY_STORAGE,
  WAKE_WORD_STORAGE,
  type AssistantContext,
  type AssistantActions,
} from '../utils/voiceAssistant';
import type { LayoutMode } from './CarScene';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

interface VoiceAssistantOverlayProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  context: AssistantContext;
  actions: AssistantActions;
  onDuckAudio: (ducked: boolean) => void;
  layoutMode: LayoutMode;
  onWakeWordActiveChange?: (active: boolean) => void;
}

const QUICK_COMMANDS = [
  'Play KISS FM',
  'Navigate to Westwood Cross',
  'Speed cameras?',
  'Tyre pressure',
  'Sport mode',
  'Night mode',
];

export const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({
  isOpen,
  onOpenChange,
  context,
  actions,
  onDuckAudio,
  layoutMode,
  onWakeWordActiveChange,
}) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [actionBadge, setActionBadge] = useState<string | undefined>(undefined);
  const [replySource, setReplySource] = useState<'offline' | 'gemini'>('offline');
  const [textInput, setTextInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => {
    try {
      return window.localStorage.getItem(GEMINI_KEY_STORAGE) ?? '';
    } catch {
      return '';
    }
  });
  const [keySavedToast, setKeySavedToast] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(WAKE_WORD_STORAGE) === 'true';
    } catch {
      return false;
    }
  });
  const [micError, setMicError] = useState<string | null>(null);

  const activeRecRef = useRef<SpeechRecognitionInstance | null>(null);
  const wakeRecRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoCloseTimerRef = useRef<number | null>(null);
  const contextRef = useRef(context);
  const actionsRef = useRef(actions);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    contextRef.current = context;
    actionsRef.current = actions;
    isOpenRef.current = isOpen;
  });

  useEffect(() => {
    onWakeWordActiveChange?.(wakeWordEnabled);
  }, [wakeWordEnabled, onWakeWordActiveChange]);

  const clearAutoClose = useCallback(() => {
    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);

  const executeQuery = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      clearAutoClose();
      setTranscript(trimmed);
      setStatus('thinking');
      setMicError(null);
      onDuckAudio(true);

      const result = await processVoiceCommand(trimmed, contextRef.current, actionsRef.current);
      setReply(result.reply);
      setActionBadge(result.actionBadge);
      setReplySource(result.source);
      setStatus('speaking');

      speakReply(result.reply, {
        onStart: () => onDuckAudio(true),
        onEnd: () => {
          onDuckAudio(false);
          setStatus('idle');
          autoCloseTimerRef.current = window.setTimeout(() => {
            if (isOpenRef.current) {
              onOpenChange(false);
            }
          }, 5500);
        },
      });
    },
    [clearAutoClose, onDuckAudio, onOpenChange]
  );

  const stopActiveListening = useCallback(() => {
    if (activeRecRef.current) {
      try {
        activeRecRef.current.abort();
      } catch {
        // ignore
      }
      activeRecRef.current = null;
    }
  }, []);

  const startActiveListening = useCallback(() => {
    clearAutoClose();
    stopSpeaking();
    stopActiveListening();

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMicError('Voice recognition unavailable here — use quick chips or type below.');
      setStatus('idle');
      return;
    }

    // Pause wake-word listener while actively dictating
    if (wakeRecRef.current) {
      try {
        wakeRecRef.current.abort();
      } catch {
        // ignore
      }
      wakeRecRef.current = null;
    }

    try {
      const rec = new Ctor();
      rec.lang = 'en-GB';
      rec.continuous = false;
      rec.interimResults = true;

      let finalCaptured = '';

      rec.onstart = () => {
        setStatus('listening');
        setMicError(null);
        setTranscript('');
        setReply('');
        setActionBadge(undefined);
        onDuckAudio(true);
      };

      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i][0]?.transcript ?? '';
          if (event.results[i].isFinal) {
            finalCaptured += chunk;
          } else {
            interim += chunk;
          }
        }
        setTranscript((finalCaptured || interim).trim());
      };

      rec.onerror = (event) => {
        onDuckAudio(false);
        setStatus('idle');
        if (event.error === 'not-allowed') {
          setMicError('Microphone permission denied — allow mic access or type below.');
        } else if (event.error === 'no-speech') {
          setMicError('No speech detected. Tap the mic to try again.');
        } else if (event.error !== 'aborted') {
          setMicError(`Mic unavailable (${event.error}) — use quick chips or type below.`);
        }
      };

      rec.onend = () => {
        activeRecRef.current = null;
        if (finalCaptured.trim()) {
          void executeQuery(finalCaptured.trim());
        } else {
          onDuckAudio(false);
          setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
        }
      };

      activeRecRef.current = rec;
      rec.start();
    } catch {
      onDuckAudio(false);
      setStatus('idle');
      setMicError('Could not start microphone — use quick chips or type below.');
    }
  }, [clearAutoClose, executeQuery, onDuckAudio, stopActiveListening]);

  // Auto-start listening when the overlay opens via Mic tap
  useEffect(() => {
    if (isOpen) {
      startActiveListening();
    } else {
      clearAutoClose();
      stopActiveListening();
      stopSpeaking();
      onDuckAudio(false);
      setStatus('idle');
      setShowSettings(false);
    }
  }, [isOpen, startActiveListening, clearAutoClose, stopActiveListening, onDuckAudio]);

  // Optional hands-free "Hey Qashqai" wake-word background listener
  useEffect(() => {
    if (!wakeWordEnabled || isOpen) {
      if (wakeRecRef.current) {
        try {
          wakeRecRef.current.abort();
        } catch {
          // ignore
        }
        wakeRecRef.current = null;
      }
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    let cancelled = false;

    const startWakeLoop = () => {
      if (cancelled || isOpenRef.current) return;
      try {
        const rec = new Ctor();
        rec.lang = 'en-GB';
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const heard = (event.results[i][0]?.transcript ?? '').trim();
            if (/\b(hey|ok|okay)\s+(qashqai|cash cow)\b/i.test(heard)) {
              const remainder = heard
                .replace(/^.*?\b(?:hey|ok|okay)\s+(?:qashqai|cash cow)\b[,!\s]*/i, '')
                .trim();
              rec.abort();
              onOpenChange(true);
              if (remainder && event.results[i].isFinal) {
                window.setTimeout(() => void executeQuery(remainder), 150);
              }
              return;
            }
          }
        };

        rec.onend = () => {
          if (!cancelled && !isOpenRef.current) {
            window.setTimeout(startWakeLoop, 800);
          }
        };

        rec.onerror = () => {
          // Stop silently if permission denied
        };

        wakeRecRef.current = rec;
        rec.start();
      } catch {
        // Ignore wake loop start errors
      }
    };

    startWakeLoop();

    return () => {
      cancelled = true;
      if (wakeRecRef.current) {
        try {
          wakeRecRef.current.abort();
        } catch {
          // ignore
        }
        wakeRecRef.current = null;
      }
    };
  }, [wakeWordEnabled, isOpen, onOpenChange, executeQuery]);

  const handleToggleWakeWord = () => {
    const next = !wakeWordEnabled;
    setWakeWordEnabled(next);
    try {
      window.localStorage.setItem(WAKE_WORD_STORAGE, String(next));
    } catch {
      // ignore
    }
  };

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleaned = geminiKey.trim();
      if (cleaned) {
        window.localStorage.setItem(GEMINI_KEY_STORAGE, cleaned);
      } else {
        window.localStorage.removeItem(GEMINI_KEY_STORAGE);
      }
      setKeySavedToast(true);
      window.setTimeout(() => setKeySavedToast(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const bottomOffset =
    layoutMode === 'horizontal-mobile'
      ? 'bottom-12'
      : layoutMode === 'vertical-mobile'
        ? 'bottom-14'
        : 'bottom-16';

  return (
    <div
      className={`fixed inset-x-0 ${bottomOffset} z-50 flex justify-center px-3 pointer-events-none`}
    >
      <div className="pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/92 shadow-[0_18px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        {/* Google Assistant-style 4-color glowing top bar */}
        <div
          className={`h-1 w-full bg-gradient-to-r from-blue-500 via-red-500 via-amber-400 to-emerald-400 transition-opacity duration-300 ${
            status === 'listening' || status === 'thinking'
              ? 'opacity-100 animate-pulse'
              : 'opacity-70'
          }`}
        />

        <div className={layoutMode === 'horizontal-mobile' ? 'p-2.5' : 'p-3.5'}>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() =>
                  status === 'listening' ? stopActiveListening() : startActiveListening()
                }
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition cursor-pointer ${
                  status === 'listening'
                    ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.75)]'
                    : status === 'speaking'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={status === 'listening' ? 'Stop listening' : 'Tap to speak'}
                aria-label={status === 'listening' ? 'Stop listening' : 'Tap to speak'}
              >
                {status === 'listening' && (
                  <span className="absolute inset-0 rounded-full bg-blue-400/40 animate-ping" />
                )}
                {status === 'speaking' ? (
                  <Volume2 className="relative h-4 w-4" />
                ) : status === 'listening' ? (
                  <Mic className="relative h-4 w-4" />
                ) : (
                  <MicOff className="relative h-4 w-4" />
                )}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <span className="text-xs font-semibold text-white">Qashqai AI</span>
                  {actionBadge && (
                    <span className="rounded-full bg-sky-500/20 border border-sky-400/30 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                      {actionBadge}
                    </span>
                  )}
                  {replySource === 'gemini' && reply && (
                    <span className="rounded-full bg-purple-500/20 border border-purple-400/30 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300">
                      Gemini
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-zinc-400">
                  {status === 'listening'
                    ? transcript || 'Listening… say a command'
                    : status === 'thinking'
                      ? 'Thinking…'
                      : transcript || 'Tap mic, pick a command, or type below'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleToggleWakeWord}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition cursor-pointer ${
                  wakeWordEnabled
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                }`}
                title='Toggle hands-free "Hey Qashqai" wake word'
              >
                <Radio className="h-3 w-3" />
                <span className="hidden sm:inline">Hey Qashqai</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAutoClose();
                  setShowSettings((s) => !s);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-full border transition cursor-pointer ${
                  showSettings
                    ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                }`}
                title="AI Settings (Optional Gemini API Key)"
                aria-label="Assistant Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition cursor-pointer"
                aria-label="Close Assistant"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Reply Bubble or Mic Info */}
          {reply && (
            <div className="mt-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs leading-relaxed text-zinc-100">
              {reply}
            </div>
          )}
          {micError && !reply && (
            <div className="mt-2 text-[11px] text-amber-300/90 px-1">{micError}</div>
          )}

          {/* Optional Gemini API Key Settings */}
          {showSettings && (
            <form
              onSubmit={handleSaveGeminiKey}
              className="mt-2.5 rounded-2xl border border-white/10 bg-black/60 p-2.5"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-zinc-200">
                  Optional Gemini API Key (for general AI Q&A)
                </span>
                {keySavedToast && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza... (stored locally on this device)"
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-sky-400/50"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Quick-Command Chips */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => void executeQuery(cmd)}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/15 hover:text-white transition cursor-pointer"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Type-to-Ask Fallback Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!textInput.trim()) return;
              const q = textInput;
              setTextInput('');
              void executeQuery(q);
            }}
            className="mt-2 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-1"
          >
            <input
              type="text"
              value={textInput}
              onFocus={clearAutoClose}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder='Type a command or ask anything (e.g. "Set temp to 20")...'
              className="flex-1 bg-transparent py-1 text-xs text-white placeholder-zinc-500 outline-none"
            />
            <button
              type="submit"
              className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500 text-white hover:bg-sky-400 transition cursor-pointer"
              aria-label="Send command"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
