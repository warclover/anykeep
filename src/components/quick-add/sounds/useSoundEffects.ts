/**
 * Sound Effects Hook
 *
 * Provides sound feedback for user interactions.
 * Disabled by default, can be enabled in user settings.
 */

import { useCallback, useRef, useEffect, useState } from "react";

// Sound effect paths (relative to public folder)
const SOUND_EFFECTS = {
  focus: "/sounds/focus.mp3",
  success: "/sounds/success.mp3",
  error: "/sounds/error.mp3",
} as const;

export type SoundEffectType = keyof typeof SOUND_EFFECTS;

// Storage key for sound settings
const SOUND_ENABLED_KEY = "anykeep_sound_enabled";
const SOUND_VOLUME_KEY = "anykeep_sound_volume";

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-1
}

export interface UseSoundEffectsReturn {
  play: (type: SoundEffectType) => void;
  settings: SoundSettings;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}

// Helper to get initial settings from localStorage
function getInitialSettings(): SoundSettings {
  if (typeof window === "undefined") {
    return { enabled: false, volume: 0.5 };
  }
  const savedEnabled = localStorage.getItem(SOUND_ENABLED_KEY);
  const savedVolume = localStorage.getItem(SOUND_VOLUME_KEY);
  return {
    enabled: savedEnabled === "true",
    volume: savedVolume ? parseFloat(savedVolume) : 0.5,
  };
}

export function useSoundEffects(): UseSoundEffectsReturn {
  // Settings state with lazy initialization
  const [settings, setSettings] = useState<SoundSettings>(getInitialSettings);

  // Audio cache
  const audioCache = useRef<Map<SoundEffectType, HTMLAudioElement>>(new Map());

  // Preload audio files
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Capture current ref value for cleanup
    const cache = audioCache.current;

    // Preload all sound effects
    Object.entries(SOUND_EFFECTS).forEach(([type, path]) => {
      const audio = new Audio(path);
      audio.preload = "auto";
      cache.set(type as SoundEffectType, audio);
    });

    return () => {
      // Clean up using captured ref value
      cache.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      cache.clear();
    };
  }, []);

  // Play sound effect
  const play = useCallback(
    (type: SoundEffectType) => {
      if (!settings.enabled) return;
      if (typeof window === "undefined") return;

      let audio = audioCache.current.get(type);

      if (!audio) {
        // Create new audio if not in cache
        audio = new Audio(SOUND_EFFECTS[type]);
        audioCache.current.set(type, audio);
      }

      // Reset and play
      audio.volume = settings.volume;
      audio.currentTime = 0;

      // Play with error handling (silently fail if autoplay is blocked)
      audio.play().catch(() => {
        // Autoplay blocked - ignore silently
      });
    },
    [settings.enabled, settings.volume],
  );

  // Update enabled setting
  const setEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }, []);

  // Update volume setting
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setSettings((prev) => ({ ...prev, volume: clampedVolume }));
    localStorage.setItem(SOUND_VOLUME_KEY, String(clampedVolume));
  }, []);

  return {
    play,
    settings,
    setEnabled,
    setVolume,
  };
}

/**
 * Create placeholder sound files instructions
 *
 * Since we can't create actual audio files, here are instructions
 * for adding the sound effects:
 *
 * 1. Create the following files in /public/sounds/:
 *    - focus.mp3 (~50ms, light click sound)
 *    - success.mp3 (~200ms, pleasant chime)
 *    - error.mp3 (~150ms, soft warning tone)
 *
 * 2. Requirements:
 *    - Format: MP3 (best compatibility)
 *    - Duration: < 500ms
 *    - File size: < 20KB each
 *    - Style: Subtle, non-intrusive
 *
 * 3. Free sound resources:
 *    - https://freesound.org/
 *    - https://mixkit.co/free-sound-effects/
 *    - https://soundbible.com/
 */
